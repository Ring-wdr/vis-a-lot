// 정합성 테스트와 벤치마크가 함께 쓰는 입력. 시드가 같으면 늘 같은 데이터다.

import { createRandom } from "../data/random";
import type { BinPlot, LinearAxis } from "./kernels";

export type PointFixture = {
  xs: Float64Array;
  ys: Float64Array;
  /** 0..n-1 */
  idx: Int32Array;
};

/**
 * 시계열 비슷한 점. x는 시각(epoch ms)을 섞어 정렬되지 않게 두고, 일부 값은 겹치게 한다.
 * y는 랜덤 워크에 잡음을 얹는다.
 */
export function points(n: number, seed = 1): PointFixture {
  const r = createRandom(seed);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const start = Date.UTC(2026, 0, 1);
  let walk = 0;
  for (let i = 0; i < n; i++) {
    // 값 겹침: 10%는 앞 점과 같은 x
    xs[i] =
      i > 0 && r.next() < 0.1
        ? xs[i - 1]
        : start + Math.floor(r.next() * 365 * 86_400_000);
    walk += r.normal();
    ys[i] = walk + r.normal() * 5;
  }
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  return { xs, ys, idx };
}

export function extentOf(values: Float64Array): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/** 800×450 PNG의 그림 영역과 데이터 범위에 맞춘 축 (scatter 기본 크기 근처) */
export function plotFor(p: PointFixture) {
  const plot: BinPlot = { left: 48, top: 32, width: 720, height: 380 };
  const [x0, x1] = extentOf(p.xs);
  const [y0, y1] = extentOf(p.ys);
  const x: LinearAxis = {
    d0: x0,
    d1: x1,
    r0: plot.left,
    r1: plot.left + plot.width,
  };
  const y: LinearAxis = {
    d0: y0,
    d1: y1,
    r0: plot.top + plot.height,
    r1: plot.top,
  };
  return { plot, x, y };
}
