// bar / boxplot 렌더러. x축은 범주 인덱스(0, 1, 2 …)를 연속 좌표로 쓴다.
// 그래서 확대(인덱스 범위)와 데이터 좌표 도형이 scatter와 같은 방식으로 동작한다.
// legend가 있으면 범주 하나 안에 legend 값별 막대/상자를 나란히 놓는다.

import { scaleLinear } from "d3-scale";
import type { BoxStats } from "../data/category-data";
import { AGG_LABELS, type AggFn } from "../data/schema";
import {
  drawLegend,
  LEGEND_SPACE,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import type { AxisMeta, ItemView, ProgressFn } from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import { THEME } from "./theme";

export type CategoryMeta = {
  chartType: "bar" | "boxplot";
  plot: { left: number; top: number; width: number; height: number };
  /** 범주 인덱스 공간 */
  x: AxisMeta;
  y: AxisMeta;
  categories: string[];
  /** 범주 하나에 놓인 막대/상자 묶음의 픽셀 너비 */
  markWidth: number;
  /** 범주 하나에 나란히 놓는 막대/상자 수 (legend 값 수, 없으면 1) */
  groupCount: number;
  /** 묶음 안에서 막대/상자 사이 간격(px). 화면이 groupSlot을 같은 값으로 계산한다. */
  groupGap: number;
  agg?: AggFn;
  /** [범주][legend 값] */
  bars?: (number | null)[][];
  /** 툴팁용 통계. 이상치 값 목록은 빼고 개수만 둔다. */
  boxes?: (Omit<BoxStats, "outliers"> | null)[][];
  legend?: LegendMeta;
};

export type CategoryInput = {
  chartType: "bar" | "boxplot";
  width: number;
  height: number;
  title: string;
  categories: string[];
  bars?: (number | null)[][];
  boxes?: (BoxStats | null)[][];
  agg?: AggFn;
  color: string;
  legend?: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
};

type Ctx = OffscreenCanvasRenderingContext2D;

const RADIUS = 4;
const MARK_RATIO = 0.7;
/** 나란히 놓은 막대 사이 배경색 간격 */
const GROUP_GAP = 2;

function valueExtent(input: CategoryInput): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  if (input.chartType === "bar") {
    // 막대는 0에서 시작해야 길이가 값을 정직하게 나타낸다.
    min = 0;
    max = 0;
    for (const row of input.bars ?? []) {
      for (const v of row) {
        if (v === null) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  } else {
    for (const row of input.boxes ?? []) {
      for (const b of row) {
        if (!b) continue;
        min = Math.min(min, b.lo, ...b.outliers);
        max = Math.max(max, b.hi, ...b.outliers);
      }
    }
  }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

/** 범주 i 안에서 g번째 막대/상자의 가운데 x와 너비 */
export function groupSlot(
  center: number,
  markWidth: number,
  groupCount: number,
  g: number,
) {
  const slot = markWidth / groupCount;
  return {
    cx: center - markWidth / 2 + slot * (g + 0.5),
    width: Math.max(1, slot - (groupCount > 1 ? GROUP_GAP : 0)),
  };
}

export function renderCategory(
  ctx: Ctx,
  input: CategoryInput,
  progress: ProgressFn,
): CategoryMeta {
  const { width, height, categories, view } = input;
  const n = categories.length;
  const groupCount = input.legend?.values.length ?? 1;
  const colorOf = (g: number) => input.legend?.colors[g] ?? input.color;

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);

  // ── 축 (aggregate) ────────────────────────────────────────────
  const y = scaleLinear().domain(view?.y ?? valueExtent(input));
  if (!view) y.nice(5);
  const yTicks = y.ticks(5);
  const yFormat = y.tickFormat(5);
  ctx.font = `11px ${THEME.font}`;
  const yLabelWidth = Math.max(
    ...yTicks.map((t) => ctx.measureText(yFormat(t)).width),
    10,
  );
  const plot = {
    left: Math.ceil(yLabelWidth + 14),
    top: 28 + (input.legend ? LEGEND_SPACE : 0),
    width: 0,
    height: 0,
  };
  plot.width = Math.max(10, width - plot.left - 14);
  plot.height = Math.max(10, height - plot.top - 26);
  y.range([plot.top + plot.height, plot.top]);

  const xDomain: [number, number] = view?.x ?? [-0.5, Math.max(0, n - 1) + 0.5];
  const x = scaleLinear()
    .domain(xDomain)
    .range([plot.left, plot.left + plot.width]);
  const band = plot.width / (xDomain[1] - xDomain[0]);
  const markWidth = Math.max(1, band * MARK_RATIO);
  progress("aggregate", 1);

  // ── 그리드와 축 ───────────────────────────────────────────────
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = THEME.textSecondary;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of yTicks) {
    const ty = Math.round(y(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(plot.left, ty);
    ctx.lineTo(plot.left + plot.width, ty);
    ctx.stroke();
    ctx.fillText(yFormat(t), plot.left - 6, ty);
  }

  // 보이는 범주만 라벨을 달고, 겹치면 건너뛴다.
  const first = Math.max(0, Math.ceil(xDomain[0]));
  const last = Math.min(n - 1, Math.floor(xDomain[1]));
  const widest = Math.max(
    ...categories.slice(first, last + 1).map((c) => ctx.measureText(c).width),
    1,
  );
  const step = Math.max(
    1,
    Math.ceil(Math.min(widest, 80) / Math.max(band, 1) + 0.2),
  );
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = first; i <= last; i += step) {
    ctx.fillText(
      truncate(ctx, categories[i], band * step - 4),
      x(i),
      plot.top + plot.height + 7,
    );
  }
  ctx.strokeStyle = THEME.axis;
  const baseY =
    Math.round(y(input.chartType === "bar" ? 0 : y.domain()[0])) + 0.5;
  ctx.beginPath();
  ctx.moveTo(plot.left, baseY);
  ctx.lineTo(plot.left + plot.width, baseY);
  ctx.stroke();

  // ── 제목 ──────────────────────────────────────────────────────
  ctx.fillStyle = THEME.textPrimary;
  ctx.font = `600 12px ${THEME.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(input.title, plot.left, 17, plot.width);
  ctx.fillStyle = THEME.textMuted;
  ctx.font = `11px ${THEME.font}`;
  ctx.textAlign = "right";
  ctx.fillText(
    input.chartType === "bar"
      ? `${input.agg ? AGG_LABELS[input.agg] : ""} · ${n}개 범주`
      : `${n}개 범주`,
    plot.left + plot.width,
    17,
  );

  // ── legend ────────────────────────────────────────────────────
  const legendMeta = input.legend
    ? drawLegend(ctx, input.legend, plot.left, 24, plot.width)
    : undefined;

  // ── 막대 / 상자 (render) ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  if (input.chartType === "bar") {
    const zero = y(0);
    (input.bars ?? []).forEach((row, i) => {
      row.forEach((v, g) => {
        if (v === null) return;
        const { cx, width: w } = groupSlot(x(i), markWidth, groupCount, g);
        const top = Math.min(y(v), zero);
        const h = Math.abs(y(v) - zero);
        const r = Math.min(RADIUS, w / 2, h);
        // 데이터 끝(바깥쪽)만 둥글게, 기준선 쪽은 각지게 둔다.
        const radii = v >= 0 ? [r, r, 0, 0] : [0, 0, r, r];
        ctx.fillStyle = colorOf(g);
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, top, w, Math.max(h, 1), radii);
        ctx.fill();
      });
      if (i % 200 === 0) progress("render", i / n);
    });
  } else {
    (input.boxes ?? []).forEach((row, i) => {
      row.forEach((b, g) => {
        if (!b) return;
        const { cx, width: w } = groupSlot(x(i), markWidth, groupCount, g);
        const half = w / 2;
        const color = colorOf(g);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        // 수염
        ctx.beginPath();
        ctx.moveTo(cx, y(b.hi));
        ctx.lineTo(cx, y(b.q3));
        ctx.moveTo(cx, y(b.q1));
        ctx.lineTo(cx, y(b.lo));
        ctx.moveTo(cx - half / 2, y(b.hi));
        ctx.lineTo(cx + half / 2, y(b.hi));
        ctx.moveTo(cx - half / 2, y(b.lo));
        ctx.lineTo(cx + half / 2, y(b.lo));
        ctx.stroke();
        // 상자
        const top = y(b.q3);
        const h = Math.max(1, y(b.q1) - top);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = color;
        ctx.fillRect(cx - half, top, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(cx - half, top, w, h);
        // 중앙값
        ctx.strokeStyle = THEME.textPrimary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - half, y(b.median));
        ctx.lineTo(cx + half, y(b.median));
        ctx.stroke();
        // 이상치
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        for (const o of b.outliers) {
          ctx.beginPath();
          ctx.arc(cx, y(o), 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      if (i % 50 === 0) progress("render", i / n);
    });
  }
  drawShapes(
    ctx,
    input.shapes,
    (v) => x(v),
    (v) => y(v),
  );
  ctx.restore();
  progress("render", 1);

  return {
    chartType: input.chartType,
    plot,
    x: { kind: "number", domain: [x.domain()[0], x.domain()[1]] },
    y: { kind: "number", domain: [y.domain()[0], y.domain()[1]] },
    categories,
    markWidth,
    groupCount,
    groupGap: GROUP_GAP,
    agg: input.agg,
    bars: input.bars,
    boxes: input.boxes?.map((row) =>
      row.map((b) => {
        if (!b) return null;
        const { outliers: _outliers, ...rest } = b;
        return rest;
      }),
    ),
    legend: legendMeta,
  };
}
