// FSD 구조 검사. 규칙은 docs/architecture.md.
// 사용법: node scripts/check-fsd.mjs [파일...]   (파일을 주지 않으면 모든 앱과 공유 패키지 전체)
// pnpm lint, .husky/pre-commit, .claude/hooks/check-fsd.mjs가 함께 쓴다.
//
// 검사 대상
//   apps/<앱>/src, apps/<앱>/app   앱마다 따로 FSD 레이어를 둔다 (@/* = 그 앱의 src/*).
//   packages/<FSD 패키지>           package.json에 "vis-a-lot": { "fsd": true }를 적은 패키지(지금은 packages/shared).
//                                   두 앱이 함께 쓰는 shared 레이어다. 폴더가 곧 segment다.
//   packages/<도구>                 표식이 없는 packages/*는 FSD 밖의 개발 도구 패키지(@vis-a-lot/tsconfig,
//                                   @vis-a-lot/i18n-check 등)다. 레이어는 보지 않고, 앱(@vis-a-lot/<앱>)을
//                                   import하거나 선언하지 않은 workspace 패키지를 import하는 것만 막는다.
// 앱이 import하는 @vis-a-lot/<FSD 패키지>/<segment>/… 는 shared 레이어로 본다.
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
const CODE_ANY = /\.(m|c)?(j|t)sx?$/;

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
const manifest = (dir) =>
  JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
const packageName = (dir) => manifest(dir).name;

const appDirs = workspaceDirs("apps");
/** 앱 패키지 이름 (@vis-a-lot/web 등). 다른 앱 import를 막는 데 쓴다. */
const APP_PACKAGES = new Set(appDirs.map(packageName));
const packageDirs = workspaceDirs("packages");
/** FSD 패키지(shared 레이어) 폴더. package.json의 "vis-a-lot": { "fsd": true }로 고른다. */
const fsdDirs = packageDirs.filter(
  (d) => manifest(d)["vis-a-lot"]?.fsd === true,
);
/** FSD 밖의 도구 패키지 폴더 (packages/tsconfig, packages/i18n-check 등) */
const toolDirs = packageDirs.filter((d) => !fsdDirs.includes(d));
const FSD_PACKAGES = new Set(fsdDirs.map(packageName));
const TOOL_PACKAGES = new Set(toolDirs.map(packageName));
const FSD_HINT = fsdDirs.join(", ") || "packages/<FSD 패키지>";

const inDir = (file, dir) => file === dir || file.startsWith(`${dir}/`);
/**
 * 파일이 속한 단위: 앱({ kind: "app" }), FSD 패키지({ kind: "package" }), 도구 패키지({ kind: "tool" }).
 */
function unitOf(file) {
  const fsd = fsdDirs.find((d) => inDir(file, d));
  if (fsd) return { kind: "package", dir: fsd };
  const tool = toolDirs.find((d) => inDir(file, d));
  if (tool) return { kind: "tool", dir: tool };
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
 * FSD 패키지 파일은 packages/<FSD 패키지>/<segment>/… (shared 레이어).
 */
function locate(file) {
  const unit = unitOf(file);
  if (!unit || unit.kind === "tool") return null;
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
          `${file}: FSD 패키지(${loc.unit.dir})는 shared 레이어라 segment(${[...SEGMENTS].join(", ")}) 폴더 안에 둔다.`,
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
        error: `FSD 패키지는 패키지 이름("${spec}")으로 import하지 않는다. 패키지 안은 상대 경로로, 앱은 import하지 않는다.`,
      };
    }
    if (APP_PACKAGES.has(name)) {
      return {
        error: `앱은 다른 앱(${name})을 import하지 않는다 ("${spec}"). 함께 쓰는 코드는 FSD 패키지(${FSD_HINT})로 옮긴다.`,
      };
    }
    if (!FSD_PACKAGES.has(name)) {
      return {
        error: `workspace에 없는 패키지(${name})를 import했다 ("${spec}").`,
      };
    }
    if (!declaredDeps(unit.dir).has(name)) {
      return {
        error: `${unit.dir}/package.json에 ${name}("workspace:*")를 선언하지 않고 import했다 ("${spec}").`,
      };
    }
    const segment = spec.split("/")[2];
    if (!SEGMENTS.has(segment)) {
      return {
        error: `${name}는 segment(${[...SEGMENTS].join(", ")}) 경로로 import한다 ("${spec}").`,
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
          `앱과 패키지는 package.json에 "workspace:*"로 선언하고 패키지 이름(@vis-a-lot/<패키지>/…)으로 import한다.`,
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

/** 도구 패키지 파일: 앱을 import하지 않고, workspace 패키지는 선언한 것만 import한다. 레이어는 보지 않는다. */
function toolImportErrors(file, unit) {
  const src = fs.readFileSync(file, "utf8");
  const errors = [];
  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    if (!spec.startsWith(SCOPE)) continue;
    const name = spec.split("/").slice(0, 2).join("/");
    if (APP_PACKAGES.has(name)) {
      errors.push(
        `${file}: 도구 패키지는 앱(${name})을 import하지 않는다 ("${spec}"). 앱이 도구를 쓰고, 도구는 앱을 모른다.`,
      );
    } else if (!FSD_PACKAGES.has(name) && !TOOL_PACKAGES.has(name)) {
      errors.push(
        `${file}: workspace에 없는 패키지(${name})를 import했다 ("${spec}").`,
      );
    } else if (
      name !== packageName(unit.dir) &&
      !declaredDeps(unit.dir).has(name)
    ) {
      errors.push(
        `${file}: ${unit.dir}/package.json에 ${name}("workspace:*")를 선언하지 않고 import했다 ("${spec}").`,
      );
    }
  }
  return errors;
}

function importErrors(file) {
  const unit = unitOf(file);
  if (!unit || !fs.existsSync(file)) return [];
  if (unit.kind === "tool")
    return CODE_ANY.test(file) ? toolImportErrors(file, unit) : [];
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

/** 검사할 파일인가: 앱의 src·app, FSD 패키지, 도구 패키지(node_modules 제외). */
function inScope(file) {
  if (file.split("/").includes("node_modules")) return false;
  const unit = unitOf(file);
  if (!unit) return false;
  if (unit.kind !== "app") return true;
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
        ...packageDirs.flatMap((d) => walk(d)),
      ]
).filter(inScope);
const errors = files.flatMap((f) => [
  ...structureErrors(f),
  ...(CODE.test(f) || unitOf(f)?.kind === "tool" ? importErrors(f) : []),
]);

if (errors.length) {
  process.stderr.write(
    `FSD 규칙 위반 ${errors.length}건 (docs/architecture.md)\n`,
  );
  for (const e of errors) process.stderr.write(`  ${e}\n`);
  process.exit(1);
}
