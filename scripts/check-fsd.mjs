// FSD 구조 검사. 규칙은 docs/architecture.md.
// 사용법: node scripts/check-fsd.mjs [파일...]   (파일을 주지 않으면 src 전체)
// npm run lint, .husky/pre-commit, .claude/hooks/check-fsd.mjs가 함께 쓴다.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

// 아래 레이어일수록 앞. 위 레이어는 아래 레이어만 import한다.
const LAYERS = [
  "shared",
  "entities",
  "features",
  "widgets",
  "views",
  "application",
];
// slice 없이 segment(또는 파일)로 바로 나누는 레이어
const UNSLICED = new Set(["shared", "application"]);
const SEGMENTS = new Set(["ui", "model", "api", "lib", "config"]);
const CODE = /\.(ts|tsx)$/;
// app/(Next 라우트)은 얇게 둔다: 진입(application)과 화면(views), shared만 가져다 쓴다.
const APP_IMPORTS = new Set(["application", "views", "shared"]);

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/** src/<layer>/<slice>/<segment>/... 위치 */
function locate(file) {
  const parts = file.split("/");
  if (parts[0] !== "src") return null;
  const layer = parts[1];
  return {
    layer,
    slice: UNSLICED.has(layer) ? null : parts[2],
    segment:
      layer === "shared" ? parts[2] : UNSLICED.has(layer) ? null : parts[3],
    depth: parts.length,
  };
}

function structureErrors(file) {
  const loc = locate(file);
  if (!loc) return [];
  if (!LAYERS.includes(loc.layer)) {
    return [
      `${file}: src 바로 아래에는 레이어(${LAYERS.join(", ")})만 둔다. ` +
        "도메인 폴더(예: src/feed)를 만들지 말고 역할별로 각 레이어의 slice에 나눠 넣는다.",
    ];
  }
  if (loc.layer === "application") {
    return loc.depth === 3
      ? []
      : [`${file}: application은 slice·하위 폴더 없이 파일만 둔다.`];
  }
  if (loc.layer === "shared") {
    return loc.depth >= 4 && SEGMENTS.has(loc.segment)
      ? []
      : [
          `${file}: shared는 segment(${[...SEGMENTS].join(", ")}) 폴더 안에 둔다.`,
        ];
  }
  if (loc.depth < 5 || !SEGMENTS.has(loc.segment)) {
    return [
      `${file}: ${loc.layer}는 src/${loc.layer}/<slice>/<segment>/ 안에 둔다. ` +
        `segment는 ${[...SEGMENTS].join(", ")} 중 하나.`,
    ];
  }
  return [];
}

function resolveImport(spec, from) {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) return path.join(path.dirname(from), spec);
  return null;
}

function appImportErrors(file) {
  const src = fs.readFileSync(file, "utf8");
  const errors = [];
  for (const [, spec] of src.matchAll(
    /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g,
  )) {
    const target = resolveImport(spec, file);
    const to = target && locate(target);
    if (to && !APP_IMPORTS.has(to.layer)) {
      errors.push(
        `${file}: app/은 라우트만 둔다. ${[...APP_IMPORTS].join(", ")}만 import한다 ("${spec}"). ` +
          "화면은 views/<slice>로 만들어 가져다 쓴다.",
      );
    }
  }
  return errors;
}

function importErrors(file) {
  if (file.startsWith("app/") && fs.existsSync(file))
    return appImportErrors(file);
  const me = locate(file);
  if (
    !me ||
    !LAYERS.includes(me.layer) ||
    !CODE.test(file) ||
    !fs.existsSync(file)
  )
    return [];
  const src = fs.readFileSync(file, "utf8");
  const errors = [];
  const re = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
  for (const [, spec] of src.matchAll(re)) {
    const target = resolveImport(spec, file);
    if (!target) continue;
    const to = locate(target);
    if (!to || !LAYERS.includes(to.layer)) continue;
    const a = LAYERS.indexOf(me.layer);
    const b = LAYERS.indexOf(to.layer);
    if (b > a) {
      errors.push(
        `${file}: ${me.layer}는 위 레이어 ${to.layer}를 import할 수 없다 ("${spec}"). ` +
          "쓰는 코드를 아래 레이어로 내리거나, 위 레이어에서 조합해 넘긴다.",
      );
    } else if (a === b && me.slice && me.slice !== to.slice) {
      errors.push(
        `${file}: 같은 레이어의 다른 slice ${to.layer}/${to.slice}를 import할 수 없다 ("${spec}"). ` +
          "함께 쓰는 코드는 아래 레이어로 내리고, 조합은 위 레이어에서 한다.",
      );
    }
  }
  return errors;
}

const args = process.argv
  .slice(2)
  .map((f) => path.relative(root, path.resolve(f)));
const files = (args.length ? args : [...walk("src"), ...walk("app")]).filter(
  (f) => f.startsWith("src/") || f.startsWith("app/"),
);
const errors = files.flatMap((f) => [
  ...structureErrors(f),
  ...(CODE.test(f) ? importErrors(f) : []),
]);

if (errors.length) {
  process.stderr.write(
    `FSD 규칙 위반 ${errors.length}건 (docs/architecture.md)\n`,
  );
  for (const e of errors) process.stderr.write(`  ${e}\n`);
  process.exit(1);
}
