// 정적 export 결과(out/)에서 화면마다 HTML이 불러오는 JS의 gzip 크기와 out/ 전체 JS 크기를 잰다.
// 사용법: pnpm build 뒤 node scripts/measure-route-js.mjs [저장소 경로]  (모노레포면 apps/*/out을 읽는다)
// i18n 라이브러리 비교(docs/i18n-library-comparison.md)에 썼다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const repo = path.resolve(process.argv[2] ?? ".");
// 모노레포가 된 뒤에는 앱마다 out/이 따로 있다 (도움말은 apps/help/out, 그 밖은 apps/web/out).
// 예전 커밋(루트 out/ 하나)도 잴 수 있게 루트 out/이 있으면 그것을 쓴다.
const outFor = (route) =>
  fs.existsSync(path.join(repo, "out"))
    ? path.join(repo, "out")
    : path.join(
        repo,
        "apps",
        route.startsWith("/help") ? "help" : "web",
        "out",
      );
const gz = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
const routes = {
  "/": "index.html",
  "/feed": "feed.html",
  "/help/vis/draw": "help/vis/draw.html",
  "/share": "share.html",
};
const res = {};
for (const [r, f] of Object.entries(routes)) {
  const out = outFor(r);
  const p = path.join(out, f);
  if (!fs.existsSync(p)) {
    res[r] = "missing";
    continue;
  }
  const html = fs.readFileSync(p, "utf8");
  const srcs = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map(
        (m) => m[1],
      ),
    ),
  ];
  res[r] = {
    scripts: srcs.length,
    gzipKB: +(
      srcs.reduce((s, x) => s + gz(path.join(out, x)), 0) / 1024
    ).toFixed(1),
    htmlKB: +(fs.statSync(p).size / 1024).toFixed(1),
  };
}
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
const outs = [...new Set(Object.keys(routes).map(outFor))].filter((d) =>
  fs.existsSync(path.join(d, "_next")),
);
const js = outs
  .flatMap((d) => walk(path.join(d, "_next")))
  .filter((f) => f.endsWith(".js"));
res.totalJsGzipKB = +(js.reduce((s, f) => s + gz(f), 0) / 1024).toFixed(1);
console.log(JSON.stringify(res, null, 2));
