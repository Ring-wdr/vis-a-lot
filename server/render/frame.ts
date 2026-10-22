// 축이 있는 차트가 함께 쓰는 그리기 조각: y 그리드와 눈금 글자, 제목 줄, 글자 줄이기.

import type { ScaleLinear } from "d3-scale";
import { THEME } from "./theme";

type Ctx = OffscreenCanvasRenderingContext2D;
export type Plot = { left: number; top: number; width: number; height: number };

/** 폭을 넘치는 글자는 끝을 …로 줄인다. */
export function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

/** 가로 그리드 선과 왼쪽 눈금 글자 */
export function drawYGrid(
  ctx: Ctx,
  plot: Plot,
  y: ScaleLinear<number, number>,
  ticks: number[],
  format: (v: number) => string,
) {
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = THEME.textSecondary;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of ticks) {
    const ty = Math.round(y(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(plot.left, ty);
    ctx.lineTo(plot.left + plot.width, ty);
    ctx.stroke();
    ctx.fillText(format(t), plot.left - 6, ty);
  }
}

/** 가로 기준선 (막대가 시작하는 0 등) */
export function drawBaseline(ctx: Ctx, plot: Plot, py: number) {
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.left, Math.round(py) + 0.5);
  ctx.lineTo(plot.left + plot.width, Math.round(py) + 0.5);
  ctx.stroke();
}

/** 제목(왼쪽)과 요약(오른쪽, 빈 조각은 뺀다) */
export function drawTitle(
  ctx: Ctx,
  plot: Plot,
  title: string,
  info: (string | false | undefined)[],
) {
  ctx.fillStyle = THEME.textPrimary;
  ctx.font = `600 12px ${THEME.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, plot.left, 17, plot.width);
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `11px ${THEME.font}`;
  ctx.textAlign = "right";
  ctx.fillText(info.filter(Boolean).join(" · "), plot.left + plot.width, 17);
}

/** y 눈금 글자 중 가장 긴 폭. 그림 영역 왼쪽 여백을 정한다. */
export function labelWidth(ctx: Ctx, labels: string[]) {
  ctx.font = `11px ${THEME.font}`;
  return Math.max(...labels.map((l) => ctx.measureText(l).width), 10);
}

/**
 * 인덱스 축(0, 1, 2 …)의 범주 글자. 보이는 범주만 달고, 겹치면 건너뛴다.
 * band는 인덱스 하나의 픽셀 폭이다.
 */
export function drawCategoryLabels(
  ctx: Ctx,
  plot: Plot,
  x: ScaleLinear<number, number>,
  labels: string[],
  domain: [number, number],
  band: number,
) {
  const n = labels.length;
  const first = Math.max(0, Math.ceil(domain[0]));
  const last = Math.min(n - 1, Math.floor(domain[1]));
  ctx.font = `11px ${THEME.font}`;
  const widest = Math.max(
    ...labels.slice(first, last + 1).map((c) => ctx.measureText(c).width),
    1,
  );
  const step = Math.max(
    1,
    Math.ceil(Math.min(widest, 80) / Math.max(band, 1) + 0.2),
  );
  ctx.fillStyle = THEME.textSecondary;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = first; i <= last; i += step) {
    ctx.fillText(
      truncate(ctx, labels[i], band * step - 4),
      x(i),
      plot.top + plot.height + 7,
    );
  }
}
