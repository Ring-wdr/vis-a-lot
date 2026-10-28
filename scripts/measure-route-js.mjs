// 정적 export 결과(out/)에서 화면마다 HTML이 불러오는 JS의 gzip 크기와 out/ 전체 JS 크기를 잰다.
// 사용법: pnpm build 뒤 node scripts/measure-route-js.mjs [저장소 경로]
// i18n 라이브러리 비교(docs/i18n-library-comparison.md)에 썼다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const repo = path.resolve(process.argv[2] ?? ".");
const out = path.join(repo, "out");
const gz = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
const routes = {
  "/": "index.html",
  "/feed": "feed.html",
  "/help/vis/draw": "help/vis/draw.html",
  "/share": "share.html",
};
const res = {};
for (const [r, f] of Object.entries(routes)) {
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
const js = walk(path.join(out, "_next")).filter((f) => f.endsWith(".js"));
res.totalJsGzipKB = +(js.reduce((s, f) => s + gz(f), 0) / 1024).toFixed(1);
console.log(JSON.stringify(res, null, 2));
