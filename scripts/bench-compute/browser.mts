// 브라우저(Chromium) 벤치 실행기. 결과 해석은 docs/wasm-compute-benchmark.md.
// 사용법: pnpm wasm:build && pnpm bench:compute:browser [--json out.json] [--rounds 15]
// Playwright와 Chromium이 따로 설치돼 있어야 한다 (프로젝트 의존성에 넣지 않았다).
// 번들은 tsx가 함께 가져오는 esbuild로 만든다.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { kernelTables } from "./cases";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const rounds = Number(flag("--rounds") ?? 15);
const sizes = (flag("--sizes") ?? "10000,100000,1000000")
  .split(",")
  .map(Number);
const renderSizes = (flag("--render-sizes") ?? "10000,100000,1000000")
  .split(",")
  .map(Number);

// esbuild·Playwright는 프로젝트 의존성이 아니라서 쓰는 만큼만 타입을 적는다.
type Esbuild = {
  build(options: Record<string, unknown>): Promise<{
    outputFiles?: { contents: Uint8Array }[];
  }>;
};
type Page = {
  on(
    event: string,
    listener: (v: { text?(): string; message?: string }) => void,
  ): void;
  goto(url: string): Promise<unknown>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  evaluate<A, R>(fn: (arg: A) => Promise<R>, arg: A): Promise<R>;
};
type Browser = {
  newPage(): Promise<Page>;
  close(): Promise<void>;
  version(): string;
};
type Playwright = { chromium: { launch(): Promise<Browser> } };

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as Esbuild;
// Playwright는 전역 설치본을 쓴다 (PLAYWRIGHT_PATH로 바꿀 수 있다).
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return createRequire(
      process.env.PLAYWRIGHT_PATH ?? "/opt/node-tools/node_modules/",
    )("playwright");
  }
})() as Playwright;

const root = new URL("../../", import.meta.url);
const out = mkdtempSync(join(tmpdir(), "bench-compute-"));
const here = (p: string) => new URL(p, import.meta.url).pathname;
await esbuild.build({
  entryPoints: {
    entry: here("./browser-entry.ts"),
    worker: here("./browser-worker.ts"),
  },
  bundle: true,
  format: "esm",
  minify: true,
  outdir: out,
  target: "es2022",
  logLevel: "warning",
});
const wasmBytes = readFileSync(
  new URL("server/compute/vis-compute.wasm", root),
);
writeFileSync(join(out, "vis-compute.wasm"), wasmBytes);
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><script type="module" src="./entry.js"></script>`,
);

// 번들 크기: wasm과 래퍼(server/compute/wasm.ts만 묶은 것)
const wrapper = await esbuild.build({
  entryPoints: [new URL("server/compute/wasm.ts", root).pathname],
  bundle: true,
  format: "esm",
  minify: true,
  write: false,
  logLevel: "warning",
});
const wrapperBytes = wrapper.outputFiles?.[0]?.contents ?? new Uint8Array();
const size = (b: Uint8Array) => ({
  raw: b.length,
  gzip: gzipSync(b, { level: 9 }).length,
  brotli: brotliCompressSync(b).length,
});
const bundle = { wasm: size(wasmBytes), wrapper: size(wrapperBytes) };

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};
const server = createServer((req, res) => {
  const path = join(
    out,
    (req.url ?? "/").split("?")[0].replace(/^\/$/, "/index.html"),
  );
  try {
    const body = readFileSync(path);
    res.writeHead(200, {
      "content-type": types[extname(path)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const base = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.error(`[page] ${m.text?.()}`));
page.on("pageerror", (e) => console.error(`[page error] ${e.message}`));
await page.goto(base);
await page.waitForFunction(() => "runBench" in globalThis);
type Result = {
  env: { runtime: string };
  init: Record<string, number>;
  kernels: Parameters<typeof kernelTables>[0];
  render: Record<string, number | string>[];
  block: Record<string, number>;
};
const result = await page.evaluate(
  (cfg) =>
    (
      globalThis as unknown as { runBench: (c: unknown) => Promise<Result> }
    ).runBench(cfg),
  {
    wasmUrl: `${base}vis-compute.wasm`,
    workerUrl: `${base}worker.js`,
    sizes,
    renderSizes,
    rounds,
    pixelRatio: 1,
    blockN: 1_000_000,
  },
);
await browser.close();
server.close();

const ms = (v: number) => v.toFixed(2);
console.log(
  `\n${result.env.runtime}\nChromium ${browser.version()}, 중앙값 ${rounds}회\n`,
);
console.log("| 초기화 | ms |\n|---|---:|");
for (const [k, v] of Object.entries(result.init))
  console.log(`| ${k} | ${v.toFixed(3)} |`);
console.log("\n| 번들 | raw | gzip | brotli |\n|---|---:|---:|---:|");
for (const [k, v] of Object.entries(bundle))
  console.log(`| ${k} | ${v.raw} B | ${v.gzip} B | ${v.brotli} B |`);
console.log(kernelTables(result.kernels, sizes));
console.log(
  "\n**renderScatter (Worker, OffscreenCanvas 800×450, ms)**\n\n| 차트 | n | 전체 | 준비 | aggregate | 그리기 | PNG 인코딩 | 같은 데이터 정렬(js 원본) |\n|---|---:|---:|---:|---:|---:|---:|---:|",
);
for (const r of result.render)
  console.log(
    `| ${r.chartType} | ${Number(r.n).toLocaleString("en")} | ${ms(Number(r.total))} | ${ms(Number(r.prepare))} | ${ms(Number(r.aggregate))} | ${ms(Number(r.paint))} | ${ms(Number(r.encode))} | ${ms(Number(r.sort))} |`,
  );
console.log(
  "\n**메인 스레드 멈춤 (정렬 1,000,000행, ms)**\n\n| 항목 | ms |\n|---|---:|",
);
for (const [k, v] of Object.entries(result.block))
  console.log(`| ${k} | ${ms(v)} |`);

const json = flag("--json");
if (json)
  writeFileSync(
    json,
    JSON.stringify({ ...result, chromium: browser.version(), bundle }, null, 2),
  );
