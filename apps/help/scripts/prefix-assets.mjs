// next build(output: "export") 뒤에 out/_next를 out/<asset prefix>/_next로 옮긴다. build 스크립트가 부른다.
//
// 도움말 앱은 Vercel Microfrontends의 자식 앱이라 web 앱과 같은 도메인에 붙는다 (docs/deploy.md).
// withMicrofrontends가 assetPrefix(/help-assets)를 정해 HTML·JS가 /help-assets/_next/**를 가리키지만,
// 정적 export는 파일을 여전히 out/_next에 쓴다. 정적 호스팅에는 rewrites가 없으니 파일을 그 경로로 옮겨
// out/ 그대로 배포해도 자산이 열리게 한다. /_next/**는 web 앱이 맡는 경로라 여기 남겨 둘 이유가 없다.
// asset prefix는 withMicrofrontends와 같은 방법(microfrontends.json + 앱 이름)으로 구한다.
import fs from "node:fs";
import path from "node:path";
import {
  getApplicationContext,
  MicrofrontendsServer,
} from "@vercel/microfrontends/microfrontends/server";

const out = path.resolve("out");
const fail = (message) => {
  console.error(`prefix-assets: ${message}`);
  process.exit(1);
};

const { name } = getApplicationContext();
const app = MicrofrontendsServer.infer().config.getApplication(name);
if (app.isDefault()) {
  console.log(
    `prefix-assets: ${name}은 기본 앱이라 asset prefix가 없다. 그대로 둔다.`,
  );
  process.exit(0);
}
const prefix = app.getAssetPrefix();
const from = path.join(out, "_next");
const to = path.join(out, prefix, "_next");
if (!fs.existsSync(from))
  fail(`${from}이 없다. next build(output: "export") 뒤에 돌린다.`);

// next build는 out/을 새로 쓰므로 여기서 out/<prefix>가 이미 있으면 라우트 폴더와 이름이 겹친 것이다
// (예: prefix를 help로 두면 out/help가 페이지 폴더다). 지우지 않고 멈춘다.
if (fs.existsSync(path.join(out, prefix)))
  fail(
    `out/${prefix}이 이미 있다. asset prefix가 라우트 경로와 겹친다. microfrontends.json의 assetPrefix를 바꾼다.`,
  );
fs.mkdirSync(path.join(out, prefix), { recursive: true });
fs.renameSync(from, to);

// HTML이 prefix 없는 /_next/를 가리키면 web 앱으로 가서 404가 난다. 남아 있으면 멈춘다.
const html = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) html.push(p);
  }
};
walk(out);
const bare = html.filter((f) =>
  /["'(]\/_next\//.test(fs.readFileSync(f, "utf8")),
);
if (bare.length > 0)
  fail(
    `asset prefix 없이 /_next/를 가리키는 HTML: ${bare.map((f) => path.relative(out, f)).join(", ")}`,
  );

console.log(
  `prefix-assets: out/_next → out/${prefix}/_next (${name}, HTML ${html.length}개 확인)`,
);
