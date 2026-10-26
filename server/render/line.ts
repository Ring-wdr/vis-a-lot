// line 렌더러의 선 그리기. 축·legend·툴팁 metadata는 scatter 렌더러(renderScatter)가 그대로 만들고,
// 여기서는 legend 계열별로 x 순 정렬한 점을 픽셀 열 단위로 줄여(M4) 선으로 잇는다.

import type { PointShape, ShapeOptions } from "./options";
import { drawPoint } from "./style";

type Ctx = OffscreenCanvasRenderingContext2D;

/**
 * 계열별 점 인덱스를 x 순으로. 계열은 legend 인덱스(groupIndex), 없으면 하나다.
 * off[g]인 계열은 비워 둔다. x가 같으면 원래 순서를 지킨다.
 */
export function seriesOrder(
  xs: Float64Array,
  groupIndex: Uint8Array | undefined,
  count: number,
  off: readonly boolean[] = [],
): Int32Array[] {
  const sizes = new Int32Array(count);
  for (let i = 0; i < xs.length; i++) sizes[groupIndex ? groupIndex[i] : 0]++;
  const out = Array.from({ length: count }, (_, g) =>
    off[g] ? new Int32Array(0) : new Int32Array(sizes[g]),
  );
  const fill = new Int32Array(count);
  for (let i = 0; i < xs.length; i++) {
    const g = groupIndex ? groupIndex[i] : 0;
    if (off[g]) continue;
    out[g][fill[g]++] = i;
  }
  for (const order of out) {
    // 이미 정렬된 경우(시각 순으로 쌓인 데이터)가 많아 먼저 확인한다.
    let sorted = true;
    for (let k = 1; k < order.length; k++) {
      if (xs[order[k]] < xs[order[k - 1]]) {
        sorted = false;
        break;
      }
    }
    if (!sorted) order.sort((a, b) => xs[a] - xs[b] || a - b);
  }
  return out;
}

/**
 * M4 다운샘플: x 순 점(order[from, to))을 픽셀 열마다 첫 점·y 최소·y 최대·끝 점 넷만 남긴다.
 * 남긴 점을 순서대로 이으면 원래 선과 같은 픽셀을 칠한다. 그림 영역 밖의 점은 양쪽 바깥 한 열씩에 모은다.
 */
export function m4(
  order: ArrayLike<number>,
  from: number,
  to: number,
  sx: ArrayLike<number>,
  sy: ArrayLike<number>,
  range: [number, number],
): number[] {
  const out: number[] = [];
  const lo = Math.floor(range[0]) - 1;
  const hi = Math.ceil(range[1]) + 1;
  let column = Number.NaN;
  let first = -1;
  let min = -1;
  let max = -1;
  let last = -1;
  const flush = () => {
    if (first === -1) return;
    // 열 안의 x 순서(order 위치)대로 넣고, 같은 점은 한 번만
    const picks = [first, min, max, last].sort((a, b) => a - b);
    for (let k = 0; k < picks.length; k++) {
      if (k === 0 || picks[k] !== picks[k - 1]) out.push(order[picks[k]]);
    }
  };
  for (let k = from; k < to; k++) {
    const i = order[k];
    const c = Math.min(hi, Math.max(lo, Math.floor(sx[i])));
    if (c !== column) {
      flush();
      column = c;
      first = min = max = last = k;
      continue;
    }
    if (sy[i] < sy[order[min]]) min = k;
    if (sy[i] > sy[order[max]]) max = k;
    last = k;
  }
  flush();
  return out;
}

/**
 * keep이 1인 점이 x 순으로 이어지는 구간 [from, to). keep이 없으면 계열 전체가 한 구간이다.
 * 선택 영역처럼 일부만 진하게 그릴 때, 사이에 빠진 점이 있으면 선을 끊는다.
 */
export function runsOf(
  order: ArrayLike<number>,
  keep: Uint8Array | undefined,
): [number, number][] {
  if (!keep) return order.length > 0 ? [[0, order.length]] : [];
  const runs: [number, number][] = [];
  let start = -1;
  for (let k = 0; k <= order.length; k++) {
    const inside = k < order.length && keep[order[k]] === 1;
    if (inside && start === -1) start = k;
    if (!inside && start !== -1) {
      runs.push([start, k]);
      start = -1;
    }
  }
  return runs;
}

export type LineDrawInput = {
  sx: Float32Array;
  sy: Float32Array;
  /** 계열별 x 순 인덱스 (seriesOrder) */
  series: Int32Array[];
  colors: readonly string[];
  plot: { left: number; width: number };
  compact?: boolean;
  /** 선 굵기 (size.lineWidth). 없으면 1.5, 섬네일 1 */
  lineWidth?: number;
  /** 선과 점의 투명도(globalAlpha, shape.transparency). 없으면 1 */
  alpha?: number;
  /** 점이 적을 때 찍는 점의 모양 (shape·size). 없으면 반지름 2.5 원 */
  dot?: {
    shape: PointShape;
    radius: number;
    style: ShapeOptions["style"];
    borderWidth: number;
    /** style both 테두리 색 (배경색) */
    stroke: string;
  };
};

/** 계열마다 선을 긋는다. 점이 적으면 작은 점도 함께 찍는다. */
export function drawLines(ctx: Ctx, input: LineDrawInput) {
  const { sx, sy, series, colors, plot } = input;
  const range: [number, number] = [plot.left, plot.left + plot.width];
  const total = series.reduce((sum, s) => sum + s.length, 0);
  const dots = !input.compact && total <= 400;
  ctx.lineWidth = input.lineWidth ?? (input.compact ? 1 : 1.5);
  const alpha = input.alpha ?? 1;
  const { dot } = input;
  // 기본 점(원·채우기·테두리 없음)은 빠른 arc로 그린다.
  const plainDot =
    !dot ||
    (dot.shape === "circle" && dot.style !== "border" && dot.borderWidth === 0);
  const dotRadius = dot?.radius ?? 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // 선택 영역 밖은 다 그린 뒤 배경색으로 덮어 흐리게 한다 (region.dimOutside).
  ctx.globalAlpha = alpha;
  series.forEach((order, g) => {
    if (order.length === 0) return;
    ctx.strokeStyle = colors[g];
    ctx.fillStyle = colors[g];
    const runs = runsOf(order, undefined);
    ctx.beginPath();
    for (const [from, to] of runs) {
      const picks = m4(order, from, to, sx, sy, range);
      picks.forEach((i, k) => {
        if (k === 0) ctx.moveTo(sx[i], sy[i]);
        else ctx.lineTo(sx[i], sy[i]);
      });
      // 점 하나뿐인 구간은 선이 안 보이므로 점으로 남긴다.
      if (picks.length === 1) {
        const i = picks[0];
        ctx.fillRect(sx[i] - 1, sy[i] - 1, 2, 2);
      }
    }
    ctx.stroke();
    if (dots) {
      for (const [from, to] of runs) {
        for (let k = from; k < to; k++) {
          const i = order[k];
          if (plainDot || !dot) {
            ctx.beginPath();
            ctx.arc(sx[i], sy[i], dotRadius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const lineWidth = ctx.lineWidth;
            drawPoint(
              ctx,
              dot.shape,
              sx[i],
              sy[i],
              dotRadius,
              dot.style,
              dot.borderWidth,
              colors[g],
              dot.stroke,
            );
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = colors[g];
            ctx.fillStyle = colors[g];
          }
        }
      }
    }
  });
  ctx.globalAlpha = 1;
}
