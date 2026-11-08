// WASM 도입 실험 벤치마크 (Node). 결과 해석은 docs/wasm-compute-benchmark.md.
// 사용법: pnpm wasm:build && pnpm napi:build && pnpm bench:compute [--json out.json] [--rounds 15]
// napi 애드온이 없으면 그 줄은 건너뛴다.

import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { loadComputeNapi } from "../../server/compute/napi";
import { loadComputeWasm } from "../../server/compute/wasm";
import { kernelTables, median, runKernelBench } from "./cases";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const rounds = Number(flag("--rounds") ?? 15);
const sizes = (flag("--sizes") ?? "10000,100000,1000000")
  .split(",")
  .map(Number);

const root = new URL("../../", import.meta.url);
const wasmBytes = readFileSync(
  new URL("server/compute/vis-compute.wasm", root),
);

// ── 초기화 비용 ────────────────────────────────────────────────
const init: Record<string, number> = {};
{
  const compile: number[] = [];
  const inst: number[] = [];
  for (let r = 0; r < 30; r++) {
    const t0 = performance.now();
    const mod = await WebAssembly.compile(wasmBytes);
    const t1 = performance.now();
    await WebAssembly.instantiate(mod, {});
    inst.push(performance.now() - t1);
    compile.push(t1 - t0);
  }
  init["wasm compile"] = median(compile);
  init["wasm instantiate"] = median(inst);
}
const napiStart = performance.now();
const napi = loadComputeNapi();
if (napi) init["napi require (첫 1회)"] = performance.now() - napiStart;

const wasm = await loadComputeWasm(wasmBytes);
const rows = runKernelBench({
  wasm,
  napi,
  sizes,
  rounds,
  log: (line) => console.error(line),
});

const env = {
  runtime: `Node ${process.version} (V8 ${process.versions.v8})`,
  arch: process.arch,
  rounds,
};
console.log(`\n${env.runtime}, 중앙값 ${rounds}회\n`);
console.log("| 초기화 | ms |\n|---|---:|");
for (const [k, v] of Object.entries(init))
  console.log(`| ${k} | ${v.toFixed(3)} |`);
console.log(kernelTables(rows, sizes));

const json = flag("--json");
if (json) writeFileSync(json, JSON.stringify({ env, init, rows }, null, 2));
