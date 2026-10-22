// waterfall 렌더러. 범주 순서대로 값을 쌓아, 막대마다 이전 누적에서 시작해 값만큼 오르거나 내린다.
// 마지막에 0부터 최종 누적까지의 '합계' 막대를 둔다. x축은 bar처럼 막대 인덱스(0, 1, 2 …) 공간이다.
// legend는 컬럼이 아니라 막대 종류(증가·감소·합계)이고, 체크박스로 끈 종류는 그리지 않되 누적에는 넣는다.

import { scaleLinear } from "d3-scale";
import { AGG_LABELS, type AggFn } from "../data/schema";
import {
  drawBaseline,
  drawCategoryLabels,
  drawTitle,
  drawYGrid,
  labelWidth,
} from "./frame";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import type { ChartOptions } from "./options";
import { drawSelection, type Region, regionTester } from "./region";
import {
  type AxisMeta,
  compactPlot,
  type ItemView,
  type ProgressFn,
} from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import { PALETTE, THEME } from "./theme";

/** 막대 종류. 순서가 곧 legend 순서다. */
export const WATERFALL_KINDS = ["증가", "감소", "합계"] as const;
export type WaterfallKind = 0 | 1 | 2;
export const TOTAL_LABEL = WATERFALL_KINDS[2];

/** 종류별 기본 색. 합계는 item 색(공통 색)을 쓴다. */
export function waterfallDefaultColors(itemColor: string) {
  return [PALETTE[2].hex, PALETTE[1].hex, itemColor];
}

/** 막대 하나: start에서 end까지. 합계는 0에서 최종 누적까지 */
export type WaterfallStep = { start: number; end: number; kind: WaterfallKind };

export type WaterfallMeta = {
  chartType: "waterfall";
  plot: { left: number; top: number; width: number; height: number };
  /** 막대 인덱스 공간. 마지막 인덱스가 합계 */
  x: AxisMeta;
  y: AxisMeta;
  /** 데이터 범주. 막대 수는 범주 수 + 1(합계)이다. */
  categories: string[];
  steps: WaterfallStep[];
  /** 막대의 픽셀 너비 */
  markWidth: number;
  agg?: AggFn;
  /** 선택 영역 안에 든 막대 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type WaterfallInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  categories: string[];
  /** 범주별 집계값. 데이터가 없는 범주는 null (0으로 본다) */
  values: (number | null)[];
  agg?: AggFn;
  color: string;
  /** 증가·감소·합계 + 새 범례 항목 */
  legend?: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 새 범례 영역. 막대 끝이 영역 안이면 legend 끝에 덧붙인 항목 색으로 칠한다. */
  groups?: readonly Region[];
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const MARK_RATIO = 0.7;

/** 범주 값 → 누적 막대들 (+ 마지막 합계) */
export function waterfallSteps(values: (number | null)[]): WaterfallStep[] {
  let total = 0;
  const steps: WaterfallStep[] = values.map((v) => {
    const start = total;
    total += v ?? 0;
    return { start, end: total, kind: (v ?? 0) >= 0 ? 0 : 1 };
  });
  steps.push({ start: 0, end: total, kind: 2 });
  return steps;
}

/** 막대 i를 대표하는 데이터 좌표: 막대 가운데 인덱스와 끝 값. 선택·새 범례 판정에 쓴다. */
export function stepPoint(i: number, step: WaterfallStep): [number, number] {
  return [i, step.end];
}

function valueExtent(steps: WaterfallStep[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const s of steps) {
    min = Math.min(min, s.start, s.end);
    max = Math.max(max, s.start, s.end);
  }
  return min === max ? [min - 1, max + 1] : [min, max];
}

export function renderWaterfall(
  ctx: Ctx,
  input: WaterfallInput,
  progress: ProgressFn,
): WaterfallMeta {
  const { width, height, categories, view } = input;
  const steps = waterfallSteps(input.values);
  const n = steps.length;
  const labels = [...categories, TOTAL_LABEL];
  const groups = (input.groups ?? []).map(regionTester);
  const kindCount = WATERFALL_KINDS.length;
  const off = hiddenIndexes(input.legend);
  const inSelection = input.selection && regionTester(input.selection);
  const colorOf = (index: number) => input.legend?.colors[index] ?? input.color;
  /** 막대의 legend 인덱스. 새 범례 영역 안이면 덧붙인 항목이다. */
  const legendIndexOf = (i: number) => {
    const point = stepPoint(i, steps[i]);
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](point[0], point[1])) return kindCount + k;
    }
    return steps[i].kind;
  };
  let selectedCount = 0;
  if (inSelection) {
    steps.forEach((s, i) => {
      if (!off[legendIndexOf(i)] && inSelection(...stepPoint(i, s)))
        selectedCount++;
    });
  }

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);

  const y = scaleLinear().domain(view?.y ?? valueExtent(steps));
  if (!view) y.nice(5);
  const yTicks = y.ticks(5);
  const yFormat = y.tickFormat(5);
  const yLabelWidth = labelWidth(ctx, yTicks.map(yFormat));
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend);
  y.range([plot.top + plot.height, plot.top]);
  const xDomain: [number, number] = view?.x ?? [-0.5, n - 0.5];
  const x = scaleLinear()
    .domain(xDomain)
    .range([plot.left, plot.left + plot.width]);
  const band = plot.width / (xDomain[1] - xDomain[0]);
  const markWidth = Math.max(1, band * MARK_RATIO);
  progress("aggregate", 1);

  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawYGrid(ctx, plot, y, yTicks, yFormat);
    drawCategoryLabels(ctx, plot, x, labels, xDomain, band);
    drawBaseline(ctx, plot, y(0));
    drawTitle(ctx, plot, input.title, [
      input.agg && AGG_LABELS[input.agg],
      `${categories.length}개 범주`,
      inSelection && `${selectedCount}개 선택`,
    ]);
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, yLabelWidth)
      : undefined;
  }

  // ── 막대와 잇는 선 (render) ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  // 이전 막대 끝에서 다음 막대 시작까지 누적 높이를 점선으로 잇는다.
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (let i = 0; i < n - 1; i++) {
    const level = Math.round(y(steps[i].end)) + 0.5;
    ctx.moveTo(x(i) + markWidth / 2, level);
    ctx.lineTo(x(i + 1) - markWidth / 2, level);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  steps.forEach((s, i) => {
    const index = legendIndexOf(i);
    if (off[index]) return;
    const top = Math.min(y(s.start), y(s.end));
    const h = Math.abs(y(s.end) - y(s.start));
    ctx.fillStyle = colorOf(index);
    ctx.globalAlpha = !inSelection || inSelection(...stepPoint(i, s)) ? 1 : 0.2;
    ctx.beginPath();
    ctx.roundRect(x(i) - markWidth / 2, top, markWidth, Math.max(h, 1), 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (i % 200 === 0) progress("render", i / n);
  });
  if (input.selection) {
    drawSelection(ctx, input.selection, x, y, THEME.selection);
  }
  drawShapes(ctx, input.shapes, x, y);
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "waterfall",
    plot,
    x: { kind: "number", domain: [x.domain()[0], x.domain()[1]] },
    y: { kind: "number", domain: [y.domain()[0], y.domain()[1]] },
    categories,
    steps,
    markWidth,
    agg: input.agg,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
