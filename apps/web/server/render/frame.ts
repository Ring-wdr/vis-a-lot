// 축이 있는 차트가 함께 쓰는 그리기 조각: y 그리드와 눈금 글자, 제목 줄, 글자 줄이기.
// 모두 마지막 인자로 차트 속성(options)을 받고, 없으면 기본값으로 지금까지와 같이 그린다.

import { drawYAxis } from "./axis-style";
import { type ChartOptions, DEFAULT_OPTIONS } from "./options";
import {
  fontPx,
  subtitleFont,
  titleBaseline,
  titleFont,
  titleText,
} from "./style";
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

/** 가로 그리드 선과 왼쪽 눈금 글자. options가 있으면 y축 속성(axes.y)을 따른다 (axis-style.drawYAxis). */
export function drawYGrid(
  ctx: Ctx,
  plot: Plot,
  y: (v: number) => number,
  ticks: readonly number[],
  format: (v: number) => string,
  options: ChartOptions = DEFAULT_OPTIONS,
) {
  drawYAxis(ctx, plot, y, ticks, format, options);
}

/** 가로 기준선 (막대가 시작하는 0 등). x축 선 속성(axes.x.line)을 따른다. */
export function drawBaseline(
  ctx: Ctx,
  plot: Plot,
  py: number,
  options: ChartOptions = DEFAULT_OPTIONS,
) {
  const { visible, line } = options.axes.x;
  if (!visible || !line.visible) return;
  ctx.strokeStyle = line.color;
  ctx.lineWidth = line.width;
  ctx.beginPath();
  ctx.moveTo(plot.left, Math.round(py) + 0.5);
  ctx.lineTo(plot.left + plot.width, Math.round(py) + 0.5);
  ctx.stroke();
}

/**
 * 제목과 요약(오른쪽, 빈 조각은 뺀다). options.title을 따른다: 숨기면 둘 다 그리지 않고,
 * 글자를 정했으면 title(item label) 대신 쓰고, 부제목은 제목 아래 한 줄이다.
 * 가운데·오른쪽 정렬이면 요약과 겹치지 않게 요약 폭만큼 비켜 둔다.
 */
export function drawTitle(
  ctx: Ctx,
  plot: Plot,
  title: string,
  info: (string | false | undefined)[],
  options: ChartOptions = DEFAULT_OPTIONS,
) {
  const o = options.title;
  if (!o.visible) return;
  const baseline = titleBaseline(options);
  const right = plot.left + plot.width;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `${fontPx(options, 11)}px ${THEME.font}`;
  ctx.textAlign = "right";
  const summary = o.summary.visible ? info.filter(Boolean).join(" · ") : "";
  const summaryWidth = summary ? ctx.measureText(summary).width + 8 : 0;

  const text = titleText(options, title);
  ctx.fillStyle = o.color;
  ctx.font = `${o.bold ? "600 " : ""}${titleFont(options)}px ${THEME.font}`;
  ctx.textAlign = o.align;
  const x =
    o.align === "left"
      ? plot.left
      : o.align === "center"
        ? plot.left + plot.width / 2
        : right - summaryWidth;
  const maxWidth =
    o.align === "center" ? plot.width - summaryWidth * 2 : plot.width;
  ctx.fillText(text, x, baseline, Math.max(10, maxWidth));
  if (o.subtitle.trim()) {
    ctx.fillStyle = o.subtitleColor;
    ctx.font = `${subtitleFont(options)}px ${THEME.font}`;
    ctx.fillText(
      o.subtitle,
      x,
      baseline + subtitleFont(options) + 4,
      Math.max(10, maxWidth),
    );
  }
  ctx.fillStyle = o.summary.color;
  ctx.font = `${fontPx(options, 11)}px ${THEME.font}`;
  ctx.textAlign = "right";
  ctx.fillText(summary, right, baseline);
}

/** y 눈금 글자 중 가장 긴 폭. 그림 영역 왼쪽 여백을 정한다. fontSize는 눈금 글자 크기(기본 11) */
export function labelWidth(ctx: Ctx, labels: string[], fontSize = 11) {
  ctx.font = `${fontSize}px ${THEME.font}`;
  return Math.max(...labels.map((l) => ctx.measureText(l).width), 10);
}

/**
 * 인덱스 축(0, 1, 2 …)의 범주 글자. 보이는 범주만 달고, 겹치면 건너뛴다.
 * band는 인덱스 하나의 픽셀 폭이다. x축 눈금 글자 속성(axes.x.label, visible)을 따른다.
 * 글자를 돌리면 글자 높이로 간격을 정하고 80px에서 자른다.
 */
export function drawCategoryLabels(
  ctx: Ctx,
  plot: Plot,
  x: (v: number) => number,
  labels: string[],
  domain: [number, number],
  band: number,
  options: ChartOptions = DEFAULT_OPTIONS,
) {
  const axis = options.axes.x;
  if (!axis.visible || !axis.label.visible) return;
  const n = labels.length;
  const first = Math.max(0, Math.ceil(domain[0]));
  const last = Math.min(n - 1, Math.floor(domain[1]));
  const fs = fontPx(options, 11, axis.label.fontSize);
  ctx.font = `${fs}px ${THEME.font}`;
  const len = axis.tick.visible ? Math.max(0, axis.tick.length) : 0;
  const top = plot.top + plot.height + 7 + len;
  ctx.fillStyle = axis.label.color;
  if (axis.label.angle) {
    const step = Math.max(1, Math.ceil((fs + 2) / Math.max(band, 1)));
    const rad = (-axis.label.angle * Math.PI) / 180;
    ctx.textAlign = axis.label.angle > 0 ? "right" : "left";
    ctx.textBaseline = "middle";
    for (let i = first; i <= last; i += step) {
      ctx.save();
      ctx.translate(x(i), top);
      ctx.rotate(rad);
      ctx.fillText(truncate(ctx, labels[i], 80), 0, 0);
      ctx.restore();
    }
    return;
  }
  const widest = Math.max(
    ...labels.slice(first, last + 1).map((c) => ctx.measureText(c).width),
    1,
  );
  const step = Math.max(
    1,
    Math.ceil(Math.min(widest, 80) / Math.max(band, 1) + 0.2),
  );
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = first; i <= last; i += step) {
    ctx.fillText(truncate(ctx, labels[i], band * step - 4), x(i), top);
  }
}
