#!/usr/bin/env node
// 화면 문구(Lingui) 검사. lingui CLI가 잡지 못하는 것을 본다. 규칙은 docs/i18n.md.
// 사용법: vis-a-lot-i18n-check <앱 또는 패키지 폴더>   (기본은 지금 폴더)
//   @vis-a-lot/i18n-check 패키지의 bin이다. 앱(apps/web, apps/help)과 공유 패키지(packages/shared)가
//   devDependencies에 "workspace:*"로 선언하고 자기 package.json의 lint·build 스크립트로 부른다.
//   그래서 이 파일이 바뀌면 turbo·Vercel이 의존 그래프로 그 앱·패키지를 다시 검사한다.
//   앱(src/가 있는 폴더)은 src를, 패키지는 폴더 전체를 본다.
//
// 1. 자리표시자: 번역(msgstr)의 {이름}은 원문(msgid)에 있어야 하고, 원문의 {이름}은 번역에도 있어야 한다.
//    원문에서 select의 선택 값으로만 쓰는 이름(조사를 고르는 받침 등)은 번역에서 빠져도 된다.
// 2. 충돌: 카탈로그는 slice마다 나눠도 실행 중에는 한 표로 합쳐진다. 같은 원문(+context)을
//    두 카탈로그가 다르게 번역하면 나중에 등록한 쪽이 이긴다. msg({ message, context })로 나눈다.
// 3. 등록: Lingui 매크로를 쓰는 파일은 그 slice의 카탈로그 등록 모듈(config/messages)을 import한다.
//    빠뜨리면 그 화면을 먼저 열 때 번역 대신 해시 id가 보인다.
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] ?? ".");
process.chdir(target);
/** 앱이면 true. 앱은 src/<레이어>/…, 공유 패키지는 <segment>/… 로 나뉜다. */
const isApp = fs.existsSync("src");
// 앱이 쓰는 공유 패키지의 카탈로그도 실행 중에는 앱의 카탈로그와 한 표로 합쳐진다. 충돌 검사에만 넣는다.
const SHARED = "node_modules/@vis-a-lot/shared";
const sharedRoot =
  isApp && fs.existsSync(SHARED) ? fs.realpathSync(SHARED) : undefined;

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

const files = walk(isApp ? "src" : ".");
const errors = [];

// ── .po 읽기 ────────────────────────────────────────────────
function unquote(line) {
  return JSON.parse(line.slice(line.indexOf('"')));
}

/** [{ context, id, str }] (헤더 제외) */
function parsePo(file) {
  const entries = [];
  let cur = null;
  let field = null;
  const flush = () => {
    if (cur && cur.id !== "") entries.push(cur);
    cur = null;
  };
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (line === "") {
      flush();
      field = null;
    } else if (line.startsWith("#")) {
      // 주석·위치. 줄 사이에 빈 줄 없이 다음 항목이 올 수 있다.
    } else if (line.startsWith("msgctxt ")) {
      flush();
      cur = { context: unquote(line), id: "", str: "" };
      field = "context";
    } else if (line.startsWith("msgid ")) {
      if (cur && field !== "context") flush();
      cur ??= { context: "", id: "", str: "" };
      cur.id = unquote(line);
      field = "id";
    } else if (line.startsWith("msgstr ")) {
      cur.str = unquote(line);
      field = "str";
    } else if (line.startsWith('"') && cur && field) {
      cur[field] += unquote(line);
    }
  }
  flush();
  return entries;
}

// ── ICU 자리표시자 ──────────────────────────────────────────
/**
 * 메시지의 자리표시자 이름 → 쓰임새({이름}은 value, {이름, plural, …}은 plural 등).
 * plural·select의 가지 본문({…})은 다시 메시지로 읽는다. 작은따옴표는 바로 뒤가 { } # '일 때만
 * 이스케이프다 (ICU 규칙, "Couldn't"의 '는 글자다).
 */
function placeholders(message) {
  const names = new Map();
  let i = 0;
  const add = (name, use) => {
    const uses = names.get(name) ?? new Set();
    uses.add(use);
    names.set(name, uses);
  };
  const skipSpace = () => {
    while (/\s/.test(message[i] ?? "")) i++;
  };
  // 메시지 본문을 } 또는 끝까지 읽는다.
  const body = () => {
    while (i < message.length && message[i] !== "}") {
      const c = message[i];
      if (c === "'" && message[i + 1] === "'") i += 2;
      else if (c === "'" && /[{}#|]/.test(message[i + 1] ?? "")) {
        const close = message.indexOf("'", i + 1);
        i = close === -1 ? message.length : close + 1;
      } else if (c === "{") argument();
      else i++;
    }
  };
  // { 이름 [, 종류 [, 가지들]] }
  const argument = () => {
    i++; // {
    skipSpace();
    const name = /^[^\s,{}]+/.exec(message.slice(i))?.[0] ?? "";
    i += name.length;
    skipSpace();
    let type = "value";
    if (message[i] === ",") {
      i++;
      skipSpace();
      type = /^\w+/.exec(message.slice(i))?.[0] ?? "";
      i += type.length;
      skipSpace();
      if (message[i] === ",") {
        i++;
        if (/^(plural|select|selectordinal)$/.test(type)) {
          // 가지: (offset:n)? (키 {본문})+
          for (;;) {
            skipSpace();
            if (i >= message.length || message[i] === "}") break;
            const key = /^[^\s{}]+/.exec(message.slice(i))?.[0] ?? "";
            i += key.length;
            skipSpace();
            if (key.startsWith("offset:")) continue;
            if (message[i] !== "{") break;
            i++;
            body();
            i++; // }
          }
        } else {
          // number·date의 형식 글자
          while (i < message.length && message[i] !== "}") i++;
        }
      }
    }
    if (name) add(name, type);
    i++; // }
  };
  body();
  return names;
}

// ── 1·2: 카탈로그 ───────────────────────────────────────────
const poFiles = files.filter((f) => f.endsWith(".po"));
const sharedPoFiles = sharedRoot
  ? walk(sharedRoot)
      .filter((f) => f.endsWith(".po"))
      .map((f) => path.relative(target, f))
  : [];
const byLocale = new Map(); // locale → Map(key → { str, file })
// 공유 패키지의 카탈로그를 먼저 읽어 두고, 앱의 카탈로그가 그것과 다르게 번역하면 알린다.
// 패키지 카탈로그 자체의 자리표시자는 패키지가 따로 검사한다.
for (const file of [...sharedPoFiles, ...poFiles]) {
  const own = !sharedPoFiles.includes(file);
  const locale = path.basename(file, ".po").split(".").pop();
  const table = byLocale.get(locale) ?? new Map();
  byLocale.set(locale, table);
  for (const { context, id, str } of parsePo(file)) {
    const key = `${context}\u0004${id}`;
    const label = context ? `"${id}" (context: ${context})` : `"${id}"`;
    const prev = table.get(key);
    if (prev && str && prev.str && prev.str !== str) {
      errors.push(
        `${file}: ${label}을 ${prev.file}와 다르게 번역했다 ("${prev.str}" ↔ "${str}"). 실행 중에는 한쪽만 남는다. msg({ message, context })로 나눈다.`,
      );
    }
    if (!prev?.str) table.set(key, { str, file });
    if (!own || !str || str === id) continue;
    const source = placeholders(id);
    const target = placeholders(str);
    for (const name of target.keys()) {
      if (!source.has(name))
        errors.push(
          `${file}: ${label}의 번역에 원문에 없는 {${name}}가 있다 (빈 글자로 보인다).`,
        );
    }
    for (const [name, uses] of source) {
      const selectorOnly = uses.size === 1 && uses.has("select");
      if (!target.has(name) && !selectorOnly)
        errors.push(`${file}: ${label}의 번역에 {${name}}가 빠졌다.`);
    }
  }
}

// ── 3: 카탈로그 등록 ────────────────────────────────────────
const MACRO = /from\s+["']@lingui\/(?:react|core)\/macro["']/;
const CODE = /\.(ts|tsx)$/;

/** 그 파일이 import해야 하는 등록 모듈 (앱·패키지 폴더 기준 경로, 확장자 없음) */
function registration(file) {
  // 공유 패키지는 카탈로그가 하나다.
  if (!isApp) return "config/messages";
  const parts = file.split(path.sep);
  const layer = parts[1];
  if (layer === "application") return "src/application/messages";
  if (layer === "shared") return "src/shared/config/messages";
  return `src/${layer}/${parts[2]}/config/messages`;
}

function resolveImport(from, spec) {
  if (isApp && spec.startsWith("@/")) return path.join("src", spec.slice(2));
  if (spec.startsWith(".")) return path.join(path.dirname(from), spec);
  return null;
}

for (const file of files) {
  if (!CODE.test(file) || /\.test\.tsx?$/.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  if (!MACRO.test(source)) continue;
  const target = registration(file);
  if (file.replace(CODE, "") === target) continue;
  const imports = [
    ...source.matchAll(/(?:import|from)\s+["']([^"']+)["']/g),
  ].map((m) => resolveImport(file, m[1]));
  if (!imports.includes(target)) {
    const rel = path.relative(path.dirname(file), target);
    errors.push(
      `${file}: Lingui 매크로를 쓰면 카탈로그 등록 모듈을 import한다: import "${rel.startsWith(".") ? rel : `./${rel}`}";`,
    );
  }
  if (!fs.existsSync(`${target}.ts`))
    errors.push(`${file}: 등록 모듈 ${target}.ts가 없다.`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\ni18n 검사: ${errors.length}건. 규칙은 docs/i18n.md.`);
  process.exit(1);
}
/** 결과에 적을 이름: 그 폴더의 package.json 이름 (없으면 폴더 경로) */
const label = fs.existsSync("package.json")
  ? (JSON.parse(fs.readFileSync("package.json", "utf8")).name ?? target)
  : target;
console.log(
  `i18n 검사 통과: ${label} ` +
    `(카탈로그 ${poFiles.length}개${sharedPoFiles.length ? ` + 공유 패키지 ${sharedPoFiles.length}개` : ""}, 언어 ${[...byLocale.keys()].join(", ")})`,
);
