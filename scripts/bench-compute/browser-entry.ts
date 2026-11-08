// 브라우저 벤치 페이지. browser.mts가 esbuild로 묶어 Chromium에서 연다.
// 1) wasm 로드·인스턴스화 비용 2) 메인 스레드 커널 3) Worker 안 renderScatter 단계별 시간
// 4) 무거운 정렬을 메인 스레드에서 돌릴 때와 Worker로 넘길 때 메인 스레드가 멈추는 시간

import { points } from "../../server/compute/fixtures";
import { argsortCompare, argsortRadix } from "../../server/compute/kernels";
import { loadComputeWasm } from "../../server/compute/wasm";
import { median, runKernelBench } from "./cases";

type Config = {
  wasmUrl: string;
  workerUrl: string;
  sizes: number[];
  renderSizes: number[];
  rounds: number;
  pixelRatio: number;
  blockN: number;
};

/** 메인 스레드 반응성: MessageChannel 틱 사이 가장 긴 간격 (ms) */
function watchGaps() {
  const channel = new MessageChannel();
  let last = performance.now();
  let maxGap = 0;
  let running = true;
  channel.port1.onmessage = () => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
    if (running) channel.port2.postMessage(0);
  };
  channel.port2.postMessage(0);
  return () => {
    running = false;
    channel.port1.close();
    return Math.max(maxGap, performance.now() - last);
  };
}

const tick = () => new Promise((r) => setTimeout(r, 30));

async function blocking(worker: Worker, n: number, rounds: number) {
  const p = points(n, 42);
  const out: Record<string, number> = {};
  const inline = async (name: string, sort: typeof argsortRadix) => {
    const gaps: number[] = [];
    const times: number[] = [];
    for (let r = 0; r < rounds; r++) {
      const idx = p.idx.slice();
      await tick();
      const stop = watchGaps();
      await tick();
      const t = performance.now();
      sort(p.xs, idx);
      times.push(performance.now() - t);
      await tick();
      gaps.push(stop());
    }
    out[`${name} 소요`] = median(times);
    out[`${name} 메인 최대 멈춤`] = median(gaps);
  };
  await inline("메인 스레드 js 원본", argsortCompare);
  await inline("메인 스레드 js 최적화", argsortRadix);

  const viaWorker = async (name: string, transferXs: boolean) => {
    const gaps: number[] = [];
    const times: number[] = [];
    for (let r = 0; r < rounds; r++) {
      const xs = p.xs.slice();
      const idx = p.idx.slice();
      await tick();
      const stop = watchGaps();
      await tick();
      const t = performance.now();
      const done = new Promise<void>((resolve) => {
        worker.onmessage = () => resolve();
      });
      worker.postMessage(
        { type: "sort", xs, idx },
        { transfer: transferXs ? [xs.buffer, idx.buffer] : [idx.buffer] },
      );
      await done;
      times.push(performance.now() - t);
      await tick();
      gaps.push(stop());
    }
    out[`${name} 왕복`] = median(times);
    out[`${name} 메인 최대 멈춤`] = median(gaps);
  };
  await viaWorker("Worker(xs 복사) js 최적화", false);
  await viaWorker("Worker(xs transfer) js 최적화", true);
  return out;
}

async function run(cfg: Config) {
  const init: Record<string, number> = {};
  {
    // 첫 로드: fetch + compileStreaming + instantiate (HTTP 캐시가 없는 첫 요청)
    const t0 = performance.now();
    const mod = await WebAssembly.compileStreaming(fetch(cfg.wasmUrl));
    const t1 = performance.now();
    await WebAssembly.instantiate(mod, {});
    init["첫 fetch + compileStreaming"] = t1 - t0;
    init["첫 instantiate"] = performance.now() - t1;
  }
  const bytes = await (await fetch(cfg.wasmUrl)).arrayBuffer();
  {
    const compile: number[] = [];
    const inst: number[] = [];
    for (let r = 0; r < 30; r++) {
      const t0 = performance.now();
      const mod = await WebAssembly.compile(bytes);
      const t1 = performance.now();
      await WebAssembly.instantiate(mod, {});
      inst.push(performance.now() - t1);
      compile.push(t1 - t0);
    }
    init["compile (중앙값)"] = median(compile);
    init["instantiate (중앙값)"] = median(inst);
  }
  const wasm = await loadComputeWasm(bytes);
  const kernels = runKernelBench({
    wasm,
    sizes: cfg.sizes,
    rounds: cfg.rounds,
  });

  const worker = new Worker(cfg.workerUrl);
  const render = await new Promise<unknown>((resolve) => {
    worker.onmessage = (e) => resolve(e.data.rows);
    worker.postMessage({
      type: "render",
      sizes: cfg.renderSizes,
      rounds: cfg.rounds,
      pixelRatio: cfg.pixelRatio,
    });
  });
  const block = await blocking(worker, cfg.blockN, cfg.rounds);
  worker.terminate();
  return {
    env: { runtime: navigator.userAgent },
    init,
    kernels,
    render,
    block,
  };
}

(globalThis as unknown as { runBench: typeof run }).runBench = run;
