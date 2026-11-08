// WASM(crates/vis-compute)·최적화 JS가 현재 렌더러 코드와 같은 결과를 내는지 확인한다.
// napi 애드온은 `pnpm napi:build`로 만들었을 때만 확인한다 (CI에는 Rust가 없다).

import { readFileSync } from "node:fs";
import { scaleLinear } from "d3-scale";
import { beforeAll, describe, expect, it } from "vitest";
import { plotFor, points } from "./fixtures";
import {
  argsortCompare,
  argsortRadix,
  binFast,
  binOriginal,
  m4,
  m4Fast,
  seriesOrder,
} from "./kernels";
import { loadComputeNapi } from "./napi";
import { type ComputeWasm, loadComputeWasm } from "./wasm";

const wasmPath = new URL("./vis-compute.wasm", import.meta.url);
const napi = loadComputeNapi();

let wasm: ComputeWasm;
beforeAll(async () => {
  wasm = await loadComputeWasm(readFileSync(wasmPath));
});

const SIZES = [0, 1, 2, 7, 1000, 50_000];

/** 일부러 까다로운 값: 겹침, -0, 음수, 큰 수 */
const tricky = Float64Array.of(3, -0, 0, -2.5, 3, 1e300, -1e-300, 1, 3, 0);

describe("argsort", () => {
  for (const n of SIZES) {
    it(`n=${n}: 비교 정렬과 같다`, () => {
      const { xs, idx } = points(n, 7);
      const expected = idx.slice();
      argsortCompare(xs, expected);

      const radix = idx.slice();
      argsortRadix(xs, radix);
      expect(radix).toEqual(expected);

      const w = idx.slice();
      wasm.copy.argsort(xs, w);
      expect(w).toEqual(expected);

      if (napi) {
        const a = idx.slice();
        napi.argsort(xs, a);
        expect(a).toEqual(expected);
      }
    });
  }

  it("겹치는 값·-0·극값", () => {
    const idx = Int32Array.from(tricky, (_, i) => i);
    const expected = idx.slice();
    argsortCompare(tricky, expected);
    const radix = idx.slice();
    argsortRadix(tricky, radix);
    const w = idx.slice();
    wasm.copy.argsort(tricky, w);
    expect(radix).toEqual(expected);
    expect(w).toEqual(expected);
  });

  it("seriesOrder 결과와 같다 (계열 하나)", () => {
    const { xs, idx } = points(20_000, 3);
    const [order] = seriesOrder(xs, undefined, 1);
    const w = idx.slice();
    wasm.copy.argsort(xs, w);
    expect(w).toEqual(order);
  });
});

describe("m4", () => {
  for (const n of SIZES) {
    it(`n=${n}: line.ts m4와 같다`, () => {
      const p = points(n, 11);
      const { x, y, plot } = plotFor(p);
      const order = p.idx.slice();
      argsortCompare(p.xs, order);
      const { sx, sy } = binFast(p.xs, p.ys, x, y, plot);
      const range: [number, number] = [plot.left, plot.left + plot.width];
      // 앞뒤를 조금 잘라 from/to도 확인한다.
      const from = Math.min(n, 3);
      const to = Math.max(from, n - 2);
      const expected = Int32Array.from(m4(order, from, to, sx, sy, range));

      const fast = new Int32Array(to - from);
      const k = m4Fast(order, from, to, sx, sy, range, fast);
      expect(fast.subarray(0, k)).toEqual(expected);

      expect(wasm.copy.m4(order, from, to, sx, sy, range)).toEqual(expected);

      if (napi) {
        const out = new Int32Array(to - from);
        const m = napi.m4Downsample(order, from, to, sx, sy, ...range, out);
        expect(out.subarray(0, m)).toEqual(expected);
      }
    });
  }
});

describe("scatter 픽셀 칸 줄이기", () => {
  it("binOriginal의 스케일 식이 d3 scaleLinear와 같다", () => {
    const p = points(1000, 5);
    const { x, plot, y } = plotFor(p);
    const d3x = scaleLinear().domain([x.d0, x.d1]).range([x.r0, x.r1]);
    const fast = binFast(p.xs, p.ys, x, y, plot);
    for (let i = 0; i < p.xs.length; i++)
      expect(fast.sx[i]).toBe(Math.fround(d3x(p.xs[i])));
  });

  for (const n of SIZES) {
    it(`n=${n}: 원본 루프와 같다`, () => {
      const p = points(n, 13);
      const { x, y, plot } = plotFor(p);
      const expected = binOriginal(p.xs, p.ys, x, y, plot);
      expect(binFast(p.xs, p.ys, x, y, plot)).toEqual(expected);
      expect(wasm.copy.bin(p.xs, p.ys, x, y, plot)).toEqual(expected);
    });
  }

  it("그림 영역 밖·범위 0인 축", () => {
    const xs = Float64Array.of(-10, 0, 5, 5, 10, 20, 0.5);
    const ys = Float64Array.of(1, 1, 1, 1, 1, 1, 1);
    const plot = { left: 10, top: 10, width: 11, height: 5 };
    const x = { d0: 0, d1: 10, r0: 10, r1: 20 };
    const y = { d0: 1, d1: 1, r0: 15, r1: 10 };
    const expected = binOriginal(xs, ys, x, y, plot);
    expect(binFast(xs, ys, x, y, plot)).toEqual(expected);
    expect(wasm.copy.bin(xs, ys, x, y, plot)).toEqual(expected);
  });
});
