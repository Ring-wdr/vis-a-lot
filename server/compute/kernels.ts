// WASM 도입 실험(docs/wasm-compute-benchmark.md)의 JS 커널. 렌더러는 아직 이 파일을 쓰지 않는다.
// "원본"은 server/render의 현재 코드(또는 같은 모양의 루프), "최적화"는 같은 결과를 내는 typed array 구현이다.
// Rust 구현(crates/vis-compute)은 이 결과와 같아야 한다 (parity.test.ts).

import { scaleLinear } from "d3-scale";

export { m4, seriesOrder } from "../render/line";

/** 축 하나: 데이터 범위 [d0, d1] → 픽셀 범위 [r0, r1] (d3 scaleLinear와 같은 식) */
export type LinearAxis = { d0: number; d1: number; r0: number; r1: number };

export type BinPlot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BinResult = {
  sx: Float32Array;
  sy: Float32Array;
  /** 픽셀 칸마다 처음 든 점의 행 번호 (행 순서) */
  kept: Int32Array;
};

// ── argsort ─────────────────────────────────────────────────────

/** 원본(seriesOrder 안의 정렬): 비교 함수 정렬. 값이 같으면 인덱스 순 */
export function argsortCompare(xs: Float64Array, idx: Int32Array) {
  idx.sort((a, b) => xs[a] - xs[b] || a - b);
}

const RADIX_BITS = 11;
const RADIX = 1 << RADIX_BITS;
const RADIX_MASK = RADIX - 1;

/**
 * 최적화: f64 비트를 크기 순서 키(상위·하위 32비트)로 바꿔 11비트씩 6번 LSD 기수 정렬한다.
 * 안정 정렬이라 값이 같으면 원래(인덱스) 순서가 남는다. -0은 0과 같게 본다.
 * 모든 키가 같은 칸에 드는 자리는 건너뛴다 (Rust 구현과 같다).
 */
export function argsortRadix(xs: Float64Array, idx: Int32Array) {
  const n = idx.length;
  // 이미 정렬된 경우가 많아 먼저 확인한다 (seriesOrder와 같다).
  let sorted = true;
  for (let k = 1; k < n; k++) {
    if (xs[idx[k]] < xs[idx[k - 1]]) {
      sorted = false;
      break;
    }
  }
  if (sorted) return;
  const f = new Float64Array(1);
  const u = new Uint32Array(f.buffer);
  const hi = new Uint32Array(n);
  const lo = new Uint32Array(n);
  for (let k = 0; k < n; k++) {
    const v = xs[idx[k]];
    f[0] = v === 0 ? 0 : v;
    let h = u[1];
    let l = u[0];
    if (h >>> 31) {
      h = ~h >>> 0;
      l = ~l >>> 0;
    } else {
      h = (h | 0x80000000) >>> 0;
    }
    hi[k] = h;
    lo[k] = l;
  }
  // 키는 순열(pos)로 따라다닌다. pos[k] = 원래 위치
  let pos = new Int32Array(n);
  let next = new Int32Array(n);
  for (let k = 0; k < n; k++) pos[k] = k;
  const count = new Int32Array(RADIX);
  for (let pass = 0; pass < 6; pass++) {
    // 64비트를 11비트씩: 하위 32비트에서 0, 11, 22(10비트) / 상위에서 0, 11, 22(10비트)
    const words = pass < 3 ? lo : hi;
    const shift = (pass % 3) * RADIX_BITS;
    count.fill(0);
    for (let k = 0; k < n; k++) count[(words[pos[k]] >>> shift) & RADIX_MASK]++;
    // 모든 키가 한 칸에 들면 이 자리는 순서를 바꾸지 않는다 (시각 값의 상위 비트 등).
    if (count[(words[pos[0]] >>> shift) & RADIX_MASK] === n) continue;
    let sum = 0;
    for (let b = 0; b < RADIX; b++) {
      const c = count[b];
      count[b] = sum;
      sum += c;
    }
    for (let k = 0; k < n; k++) {
      const p = pos[k];
      next[count[(words[p] >>> shift) & RADIX_MASK]++] = p;
    }
    const t = pos;
    pos = next;
    next = t;
  }
  const original = idx.slice();
  for (let k = 0; k < n; k++) idx[k] = original[pos[k]];
}

// ── M4 ──────────────────────────────────────────────────────────

/**
 * 최적화한 M4: line.ts m4와 같은 결과를 out(길이 to - from 이상)에 쓰고 개수를 돌려준다.
 * 클로저·배열 push·4칸 sort 대신 정수 비교로 순서를 맞춘다.
 */
export function m4Fast(
  order: Int32Array,
  from: number,
  to: number,
  sx: Float32Array,
  sy: Float32Array,
  range: [number, number],
  out: Int32Array,
): number {
  const lo = Math.floor(range[0]) - 1;
  const hi = Math.ceil(range[1]) + 1;
  let n = 0;
  let column = Number.NaN;
  let first = -1;
  let min = -1;
  let max = -1;
  let last = -1;
  let minY = 0;
  let maxY = 0;
  for (let k = from; k <= to; k++) {
    let c = 0;
    let i = 0;
    if (k < to) {
      i = order[k];
      c = Math.floor(sx[i]);
      if (c < lo) c = lo;
      else if (c > hi) c = hi;
      if (c === column) {
        const v = sy[i];
        if (v < minY) {
          min = k;
          minY = v;
        }
        if (v > maxY) {
          max = k;
          maxY = v;
        }
        last = k;
        continue;
      }
    }
    if (first !== -1) {
      // first ≤ last이고 min·max는 그 사이. 넷을 순서대로, 같은 점은 한 번만 넣는다.
      const a = Math.min(min, max);
      const b = Math.max(min, max);
      out[n++] = order[first];
      if (a !== first) out[n++] = order[a];
      if (b !== a) out[n++] = order[b];
      if (last !== b) out[n++] = order[last];
    }
    if (k === to) break;
    column = c;
    first = min = max = last = k;
    minY = maxY = sy[i];
  }
  return n;
}

// ── scatter 픽셀 칸 줄이기 ──────────────────────────────────────

/**
 * 원본: renderScatter 집계 루프와 같은 모양 (d3 scale 함수 호출, 결과를 일반 배열에 push).
 * 선택·focus·끈 legend 처리는 뺐다.
 */
export function binOriginal(
  xs: Float64Array,
  ys: Float64Array,
  xAxis: LinearAxis,
  yAxis: LinearAxis,
  plot: BinPlot,
): BinResult {
  const x = scaleLinear()
    .domain([xAxis.d0, xAxis.d1])
    .range([xAxis.r0, xAxis.r1]);
  const y = scaleLinear()
    .domain([yAxis.d0, yAxis.d1])
    .range([yAxis.r0, yAxis.r1]);
  const n = xs.length;
  const cell = new Int32Array(plot.width * plot.height).fill(-1);
  const px: number[] = [];
  const py: number[] = [];
  const keptX: number[] = [];
  const keptY: number[] = [];
  const kept: number[] = [];
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cx = x(xs[i]);
    const cy = y(ys[i]);
    sx[i] = cx;
    sy[i] = cy;
    const ix = Math.round(cx - plot.left);
    const iy = Math.round(cy - plot.top);
    if (ix >= 0 && iy >= 0 && ix < plot.width && iy < plot.height) {
      const idx = iy * plot.width + ix;
      if (cell[idx] === -1) {
        cell[idx] = i;
        px.push(Math.round(cx));
        py.push(Math.round(cy));
        keptX.push(xs[i]);
        keptY.push(ys[i]);
        kept.push(i);
      }
    }
  }
  return { sx, sy, kept: Int32Array.from(kept) };
}

/** 최적화: 스케일 식을 풀어 쓰고 결과를 미리 잡은 typed array에 쓴다. */
export function binFast(
  xs: Float64Array,
  ys: Float64Array,
  xAxis: LinearAxis,
  yAxis: LinearAxis,
  plot: BinPlot,
  cell: Int32Array = new Int32Array(plot.width * plot.height),
): BinResult {
  const n = xs.length;
  const { d0: xd0, r0: xr0, r1: xr1 } = xAxis;
  const { d0: yd0, r0: yr0, r1: yr1 } = yAxis;
  const xSpan = xAxis.d1 - xd0;
  const ySpan = yAxis.d1 - yd0;
  const { left, top, width, height } = plot;
  cell.fill(-1);
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const kept = new Int32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const tx = xSpan ? (xs[i] - xd0) / xSpan : 0.5;
    const ty = ySpan ? (ys[i] - yd0) / ySpan : 0.5;
    const cx = xr0 * (1 - tx) + xr1 * tx;
    const cy = yr0 * (1 - ty) + yr1 * ty;
    sx[i] = cx;
    sy[i] = cy;
    const ix = Math.round(cx - left);
    const iy = Math.round(cy - top);
    if (ix >= 0 && iy >= 0 && ix < width && iy < height) {
      const idx = iy * width + ix;
      if (cell[idx] === -1) {
        cell[idx] = i;
        kept[m++] = i;
      }
    }
  }
  return { sx, sy, kept: kept.subarray(0, m) };
}
