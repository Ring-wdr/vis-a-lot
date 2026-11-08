// FSD 구조 검사. 규칙은 docs/architecture.md.
// 사용법: node scripts/check-fsd.mjs [파일...]   (파일을 주지 않으면 모든 앱과 공유 패키지 전체)
// pnpm lint, .husky/pre-commit, .claude/hooks/check-fsd.mjs가 함께 쓴다.
//
// 검사 대상
//   apps/<앱>/src, apps/<앱>/app   앱마다 따로 FSD 레이어를 둔다 (@/* = 그 앱의 src/*).
//   packages/shared                 두 앱이 함께 쓰는 shared 레이어. 폴더가 곧 segment다.
// 검사하지 않는 것
//   packages/<도구>                 FSD 밖의 개발 도구 패키지(@vis-a-lot/tsconfig, @vis-a-lot/i18n-check 등).
//                                   SHARED_DIR이 아닌 packages/* 는 모두 도구 패키지로 본다.
// 앱이 import하는 @vis-a-lot/shared/<segment>/… 는 shared 레이어로 본다.
// 도구 패키지 import는 외부 라이브러리처럼 레이어 검사에서 빼되, package.json에 선언했는지만 본다.
// 앱과 패키지 사이는 package.json의 workspace 의존과 패키지 이름으로만 잇는다. 상대 경로로 앱 밖을 가리키거나
// 다른 앱을 import하면 Vercel이 바뀐 앱을 고르는 의존 그래프에 드러나지 않으므로 막는다.
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

const SCOPE = "@vis-a-lot/";
const SHARED_PACKAGE = "@vis-a-lot/shared";
const SHARED_DIR = "packages/shared";

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/** <parent>/* 중 package.json이 있는 폴더 */
const workspaceDirs = (parent) =>
  fs.existsSync(parent)
    ? fs
        .readdirSync(parent, { withFileTypes: true })
        .filter(
          (e) =>
            e.isDirectory() &&
            fs.existsSync(path.join(parent, e.name, "package.json")),
        )
        .map((e) => `${parent}/${e.name}`)
    : [];
const packageName = (dir) =>
  JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name;

const appDirs = workspaceDirs("apps");
/** 앱 패키지 이름 (@vis-a-lot/web 등). 다른 앱 import를 막는 데 쓴다. */
const APP_PACKAGES = new Set(appDirs.map(packageName));
/** FSD 밖의 도구 패키지 이름 (@vis-a-lot/tsconfig, @vis-a-lot/i18n-check 등) */
const TOOL_PACKAGES = new Set(
  workspaceDirs("packages")
    .filter((d) => d !== SHARED_DIR)
    .map(packageName),
);

/** 파일이 속한 단위: 앱({ kind: "app", dir }) 또는 공유 패키지({ kind: "package", dir }) */
function unitOf(file) {
  if (file === SHARED_DIR || file.startsWith(`${SHARED_DIR}/`))
    return { kind: "package", dir: SHARED_DIR };
  const app = appDirs.find((d) => file.startsWith(`${d}/`));
  return app ? { kind: "app", dir: app } : null;
}

const pkgCache = new Map();
/** 앱·패키지 package.json에 선언한 의존 이름 */
function declaredDeps(dir) {
  if (!pkgCache.has(dir)) {
    const file = path.join(dir, "package.json");
    const pkg = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : {};
    pkgCache.set(
      dir,
      new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })),
    );
  }
  return pkgCache.get(dir);
}

/**
 * 파일의 FSD 위치. 앱 파일은 <앱>/src/<layer>/<slice>/<segment>/…,
 * 공유 패키지 파일은 packages/shared/<segment>/… (shared 레이어).
 */
function locate(file) {
  const unit = unitOf(file);
  if (!unit) return null;
  const rel = path.relative(unit.dir, file);
  if (rel.startsWith("..")) return null;
  const parts = rel.split("/");
  if (unit.kind === "package") {
    // 패키지 바로 아래 파일은 설정(package.json, lingui.config.ts 등)이다.
    if (parts.length === 1) return null;
    return {
      unit,
      layer: "shared",
      slice: null,
      segment: parts[0],
      depth: parts.length + 1,
      inPackage: true,
    };
  }
  if (parts[0] !== "src") return null;
  const layer = parts[1];
  return {
    unit,
    layer,
    slice: UNSLICED.has(layer) ? null : parts[2],
    segment:
      layer === "shared" ? parts[2] : UNSLICED.has(layer) ? null : parts[3],
    depth: parts.length,
    inPackage: false,
  };
}

function structureErrors(file) {
  const loc = locate(file);
  if (!loc) return [];
  if (loc.inPackage) {
    return SEGMENTS.has(loc.segment)
      ? []
      : [
          `${file}: 공유 패키지(${SHARED_DIR})는 shared 레이어라 segment(${[...SEGMENTS].join(", ")}) 폴더 안에 둔다.`,
        ];
  }
  const src = `${loc.unit.dir}/src`;
  if (!LAYERS.includes(loc.layer)) {
    return [
      `${file}: ${src} 바로 아래에는 레이어(${LAYERS.join(", ")})만 둔다. ` +
        `도메인 폴더(예: ${src}/feed)를 만들지 말고 역할별로 각 레이어의 slice에 나눠 넣는다.`,
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
      `${file}: ${loc.layer}는 ${src}/${loc.layer}/<slice>/<segment>/ 안에 둔다. ` +
        `segment는 ${[...SEGMENTS].join(", ")} 중 하나.`,
    ];
  }
  return [];
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

/**
 * import 대상. { error } 또는 { file } (저장소 기준 경로, 확장자 없음) 또는 { layer: "shared" }(패키지) 또는 null(외부 패키지).
 */
function resolveImport(spec, from, unit) {
  if (spec.startsWith(SCOPE)) {
    const name = spec.split("/").slice(0, 2).join("/");
    if (TOOL_PACKAGES.has(name)) {
      // FSD 레이어가 없는 도구 패키지다. 외부 라이브러리처럼 보되 선언은 해야 의존 그래프에 드러난다.
      return declaredDeps(unit.dir).has(name)
        ? null
        : {
            error: `${unit.dir}/package.json에 ${name}("workspace:*")를 선언하지 않고 import했다 ("${spec}").`,
          };
    }
    if (unit.kind === "package") {
      return {
        error: `공유 패키지는 패키지 이름("${spec}")으로 import하지 않는다. 패키지 안은 상대 경로로, 앱은 import하지 않는다.`,
      };
    }
    if (APP_PACKAGES.has(name)) {
      return {
        error: `앱은 다른 앱(${name})을 import하지 않는다 ("${spec}"). 함께 쓰는 코드는 ${SHARED_DIR}로 옮긴다.`,
      };
    }
    if (name !== SHARED_PACKAGE) {
      return {
        error: `workspace에 없는 패키지(${name})를 import했다 ("${spec}").`,
      };
    }
    if (!declaredDeps(unit.dir).has(SHARED_PACKAGE)) {
      return {
        error: `${unit.dir}/package.json에 ${SHARED_PACKAGE}("workspace:*")를 선언하지 않고 import했다 ("${spec}").`,
      };
    }
    const segment = spec.split("/")[2];
    if (!SEGMENTS.has(segment)) {
      return {
        error: `${SHARED_PACKAGE}는 segment(${[...SEGMENTS].join(", ")}) 경로로 import한다 ("${spec}").`,
      };
    }
    return { layer: "shared" };
  }
  if (spec.startsWith("@/")) {
    if (unit.kind === "package") {
      return {
        error: `공유 패키지는 앱의 경로 별칭 @/를 쓰지 않는다 ("${spec}"). 패키지 안은 상대 경로로 import한다.`,
      };
    }
    return { file: `${unit.dir}/src/${spec.slice(2)}` };
  }
  if (spec.startsWith(".")) {
    const target = path.join(path.dirname(from), spec);
    if (path.relative(unit.dir, target).startsWith("..")) {
      return {
        error:
          `상대 경로로 ${unit.dir} 밖을 가리킨다 ("${spec}"). ` +
          `앱과 패키지는 package.json에 "workspace:*"로 선언하고 패키지 이름(${SHARED_PACKAGE}/…)으로 import한다.`,
      };
    }
    return { file: target };
  }
  return null;
}

function appImportErrors(file, unit) {
  const src = fs.readFileSync(file, "utf8");
  const errors = [];
  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    const target = resolveImport(spec, file, unit);
    if (!target) continue;
    if (target.error) {
      errors.push(`${file}: ${target.error}`);
      continue;
    }
    const layer = target.layer ?? (target.file && locate(target.file)?.layer);
    if (layer && !APP_IMPORTS.has(layer)) {
      errors.push(
        `${file}: app/은 라우트만 둔다. ${[...APP_IMPORTS].join(", ")}만 import한다 ("${spec}"). ` +
          "화면은 views/<slice>로 만들어 가져다 쓴다.",
      );
    }
  }
  return errors;
}

function importErrors(file) {
  const unit = unitOf(file);
  if (!unit || !fs.existsSync(file)) return [];
  if (unit.kind === "app" && file.startsWith(`${unit.dir}/app/`))
    return appImportErrors(file, unit);
  const me = locate(file);
  if (!me || !LAYERS.includes(me.layer)) return [];
  const src = fs.readFileSync(file, "utf8");
  const errors = [];
  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    const target = resolveImport(spec, file, unit);
    if (!target) continue;
    if (target.error) {
      errors.push(`${file}: ${target.error}`);
      continue;
    }
    const to = target.layer
      ? { layer: target.layer, slice: null }
      : locate(target.file);
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

/** 검사할 파일인가: 앱의 src·app, 공유 패키지(node_modules 제외). 도구 패키지(packages/<도구>)는 보지 않는다. */
function inScope(file) {
  if (file.split("/").includes("node_modules")) return false;
  const unit = unitOf(file);
  if (!unit) return false;
  if (unit.kind === "package") return true;
  return (
    file.startsWith(`${unit.dir}/src/`) || file.startsWith(`${unit.dir}/app/`)
  );
}

const args = process.argv
  .slice(2)
  .map((f) => path.relative(root, path.resolve(f)));
const files = (
  args.length
    ? args
    : [
        ...appDirs.flatMap((d) => [...walk(`${d}/src`), ...walk(`${d}/app`)]),
        ...walk(SHARED_DIR),
      ]
).filter(inScope);
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
