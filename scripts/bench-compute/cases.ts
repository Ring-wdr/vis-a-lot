// 커널 벤치마크 경우. Node(node.mts)와 브라우저(browser-entry.ts)가 같은 경우를 같은 방식으로 잰다.
// 결과 해석은 docs/wasm-compute-benchmark.md.

import { plotFor, points } from "../../server/compute/fixtures";
import {
  argsortCompare,
  argsortRadix,
  binFast,
  binOriginal,
  m4,
  m4Fast,
} from "../../server/compute/kernels";
import type { ComputeNapi } from "../../server/compute/napi";
import { binParams, type ComputeWasm } from "../../server/compute/wasm";

export type Napi = ComputeNapi;

export type Case<S> = {
  /** 표본 하나에서 돌릴 k번 분량의 입력을 준비한다 (시간에 넣지 않는다). */
  setup(k: number): S;
  run(state: S, j: number): void;
  teardown?(state: S): void;
};

export type Row = {
  kernel: string;
  n: number;
  variant: string;
  ms: number;
  min: number;
  max: number;
};

export const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** 표본 하나가 이보다 짧으면 같은 표본 안에서 여러 번 돌려 나눈다 (타이머 해상도). */
const MIN_SAMPLE_MS = 5;

export function measure<S>(c: Case<S>, rounds: number) {
  // 반복 수 정하기 + 워밍업 (JIT)
  let k = 1;
  for (;;) {
    const s = c.setup(k);
    const t0 = performance.now();
    for (let j = 0; j < k; j++) c.run(s, j);
    const dt = performance.now() - t0;
    c.teardown?.(s);
    if (dt >= MIN_SAMPLE_MS || k >= 1 << 14) break;
    k *= 2;
  }
  for (let w = 0; w < 3; w++) {
    const s = c.setup(k);
    for (let j = 0; j < k; j++) c.run(s, j);
    c.teardown?.(s);
  }
  const samples: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const s = c.setup(k);
    const t0 = performance.now();
    for (let j = 0; j < k; j++) c.run(s, j);
    samples.push((performance.now() - t0) / k);
    c.teardown?.(s);
  }
  return {
    median: median(samples),
    min: Math.min(...samples),
    max: Math.max(...samples),
  };
}

export type KernelBenchOptions = {
  wasm: ComputeWasm;
  napi?: Napi;
  sizes: number[];
  rounds: number;
  log?: (line: string) => void;
};

const copies = (src: Int32Array, k: number) =>
  Array.from({ length: k }, () => src.slice());
const none = () => null;

export function runKernelBench({
  wasm,
  napi,
  sizes,
  rounds,
  log,
}: KernelBenchOptions): Row[] {
  const rows: Row[] = [];
  const record = <S>(
    kernel: string,
    n: number,
    variant: string,
    c: Case<S>,
  ) => {
    const r = measure(c, rounds);
    rows.push({ kernel, n, variant, ms: r.median, min: r.min, max: r.max });
    log?.(
      `${kernel.padEnd(8)} n=${String(n).padStart(8)} ${variant.padEnd(22)} ${r.median.toFixed(3)} ms`,
    );
  };

  for (const n of sizes) {
    const p = points(n, 42);
    const { x, y, plot } = plotFor(p);

    // argsort: 정렬 안 된 x (seriesOrder의 느린 경우)
    record("argsort", n, "js 원본(비교 정렬)", {
      setup: (k) => copies(p.idx, k),
      run: (s, j) => argsortCompare(p.xs, s[j]),
    });
    record("argsort", n, "js 최적화(기수 정렬)", {
      setup: (k) => copies(p.idx, k),
      run: (s, j) => argsortRadix(p.xs, s[j]),
    });
    record("argsort", n, "wasm 복사 포함", {
      setup: (k) => copies(p.idx, k),
      run: (s, j) => wasm.copy.argsort(p.xs, s[j]),
    });
    {
      const rx = wasm.copyIn(p.xs);
      record("argsort", n, "wasm 복사 제외", {
        setup: (k) => Array.from({ length: k }, () => wasm.copyIn(p.idx)),
        run: (s, j) => wasm.resident.argsort(rx, s[j]),
        teardown: (s) => {
          for (const r of s) r.free();
        },
      });
      rx.free();
    }
    if (napi) {
      const a = napi;
      record("argsort", n, "napi", {
        setup: (k) => copies(p.idx, k),
        run: (s, j) => a.argsort(p.xs, s[j]),
      });
    }

    // m4: x 순 점 전체를 픽셀 열로 줄인다 (line 차트 계열 하나)
    const order = p.idx.slice();
    argsortRadix(p.xs, order);
    const { sx, sy } = binFast(p.xs, p.ys, x, y, plot);
    const range: [number, number] = [plot.left, plot.left + plot.width];
    record("m4", n, "js 원본", {
      setup: none,
      run: () => m4(order, 0, n, sx, sy, range),
    });
    const out = new Int32Array(n);
    record("m4", n, "js 최적화", {
      setup: none,
      run: () => m4Fast(order, 0, n, sx, sy, range, out),
    });
    record("m4", n, "wasm 복사 포함", {
      setup: none,
      run: () => wasm.copy.m4(order, 0, n, sx, sy, range),
    });
    {
      const ro = wasm.copyIn(order);
      const rsx = wasm.copyIn(sx);
      const rsy = wasm.copyIn(sy);
      const rout = wasm.allocate<Int32Array>(Int32Array, n);
      record("m4", n, "wasm 복사 제외", {
        setup: none,
        run: () => wasm.resident.m4(ro, 0, n, rsx, rsy, range, rout),
      });
      for (const r of [ro, rsx, rsy, rout]) r.free();
    }
    if (napi) {
      const a = napi;
      record("m4", n, "napi", {
        setup: none,
        run: () => a.m4Downsample(order, 0, n, sx, sy, range[0], range[1], out),
      });
    }

    // bin: scatter 집계 루프 (픽셀 좌표 + 칸마다 첫 점)
    record("bin", n, "js 원본(d3 scale)", {
      setup: none,
      run: () => binOriginal(p.xs, p.ys, x, y, plot),
    });
    const cell = new Int32Array(plot.width * plot.height);
    record("bin", n, "js 최적화", {
      setup: none,
      run: () => binFast(p.xs, p.ys, x, y, plot, cell),
    });
    record("bin", n, "wasm 복사 포함", {
      setup: none,
      run: () => wasm.copy.bin(p.xs, p.ys, x, y, plot),
    });
    {
      const rx = wasm.copyIn(p.xs);
      const ry = wasm.copyIn(p.ys);
      const params = wasm.copyIn(binParams(x, y, plot));
      const rsx = wasm.allocate<Float32Array>(Float32Array, n);
      const rsy = wasm.allocate<Float32Array>(Float32Array, n);
      const rcell = wasm.allocate<Int32Array>(
        Int32Array,
        plot.width * plot.height,
      );
      const kept = wasm.allocate<Int32Array>(Int32Array, n);
      record("bin", n, "wasm 복사 제외", {
        setup: none,
        run: () =>
          wasm.resident.bin(rx, ry, params, plot, rsx, rsy, rcell, kept),
      });
      for (const r of [rx, ry, params, rsx, rsy, rcell, kept]) r.free();
    }
    if (napi) {
      const a = napi;
      const params = binParams(x, y, plot);
      record("bin", n, "napi", {
        setup: none,
        run: () => {
          // JS·wasm 복사 포함과 같게 결과 배열을 호출마다 새로 잡는다.
          const nsx = new Float32Array(n);
          const nsy = new Float32Array(n);
          const kept = new Int32Array(n);
          a.bin(
            p.xs,
            p.ys,
            params,
            plot.width,
            plot.height,
            nsx,
            nsy,
            cell,
            kept,
          );
        },
      });
    }
  }
  return rows;
}

/** 커널별 markdown 표. 괄호는 같은 크기 js 원본 대비 배수 */
export function kernelTables(rows: Row[], sizes: number[]): string {
  const lines: string[] = [];
  for (const kernel of ["argsort", "m4", "bin"]) {
    const variants = [
      ...new Set(rows.filter((r) => r.kernel === kernel).map((r) => r.variant)),
    ];
    lines.push(`\n**${kernel}** (ms, 괄호는 js 원본 대비 배수)\n`);
    lines.push(
      `| 구현 | ${sizes.map((n) => n.toLocaleString("en")).join(" | ")} |`,
    );
    lines.push(`|---|${sizes.map(() => "---:").join("|")}|`);
    for (const v of variants) {
      const cells = sizes.map((n) => {
        const row = rows.find(
          (r) => r.kernel === kernel && r.n === n && r.variant === v,
        );
        const base =
          rows.find((r) => r.kernel === kernel && r.n === n)?.ms ?? 1;
        return row
          ? `${row.ms.toFixed(3)} (${(base / row.ms).toFixed(1)}×)`
          : "-";
      });
      lines.push(`| ${v} | ${cells.join(" | ")} |`);
    }
  }
  return lines.join("\n");
}
