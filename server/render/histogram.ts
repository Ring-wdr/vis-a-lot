// histogram 렌더러. x축은 값 공간이라 구간 경계가 곧 데이터 좌표다.
// 그래서 확대(값 범위)와 데이터 좌표 도형·선택이 scatter와 같은 방식으로 동작한다.
// legend가 있으면 구간 하나를 legend 값 수만큼 나눠 막대를 나란히 놓는다.

import { scaleLinear } from "d3-scale";
import type { HistogramBins } from "../data/histogram-data";
import { drawBaseline, drawTitle, drawYGrid, labelWidth } from "./frame";
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
  xAxis,
} from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import { THEME } from "./theme";

export type HistogramMeta = {
  chartType: "histogram";
  plot: { left: number; top: number; width: number; height: number };
  /** 값 공간 */
  x: AxisMeta;
  /** 개수 */
  y: AxisMeta;
  bins: HistogramBins;
  /** [구간][legend 값] 개수 */
  counts: number[][];
  /** 구간 하나에 나란히 놓는 막대 수 (legend 값 수, 없으면 1) */
  groupCount: number;
  /** 선택 영역 안에 든 막대 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type HistogramInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  bins: HistogramBins;
  counts: number[][];
  color: string;
  legend?: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 새 범례 영역. 막대 끝이 영역 안이면 legend 끝에 덧붙인 항목 색으로 칠한다. */
  groups?: readonly Region[];
  /** 선택 영역. 바깥 막대는 흐리게 그린다. */
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

/** 이웃 구간 사이 간격(px). 구간이 좁으면 두지 않는다. */
const BIN_GAP = 1;

/**
 * 구간 i의 g번째 막대를 대표하는 데이터 좌표: x는 그 막대 칸의 가운데 값, y는 개수.
 * 선택·새 범례 판정과 데이터 표의 행 고르기가 같은 좌표를 쓴다.
 */
export function histogramMarkPoint(
  bins: HistogramBins,
  i: number,
  g: number,
  groupCount: number,
  count: number,
): [number, number] {
  return [bins.lo + bins.step * (i + (g + 0.5) / groupCount), count];
}

/** 값 v가 든 구간 번호. 범위 밖이면 -1. 마지막 구간은 끝값을 포함한다. */
export function binIndexOf(bins: HistogramBins, v: number) {
  const i = Math.floor((v - bins.lo) / bins.step);
  if (i === bins.count && v <= bins.lo + bins.step * bins.count) return i - 1;
  return i >= 0 && i < bins.count ? i : -1;
}

export function renderHistogram(
  ctx: Ctx,
  input: HistogramInput,
  progress: ProgressFn,
): HistogramMeta {
  const { width, height, bins, counts, view } = input;
  const groups = (input.groups ?? []).map(regionTester);
  const groupCount = Math.max(
    1,
    (input.legend?.values.length ?? 1) - groups.length,
  );
  const off = hiddenIndexes(input.legend);
  const inSelection = input.selection && regionTester(input.selection);
  const colorOf = (index: number) => input.legend?.colors[index] ?? input.color;
  const legendIndexOf = (g: number, point: readonly [number, number]) => {
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](point[0], point[1])) return groupCount + k;
    }
    return g;
  };

  // 개수 축은 보이는(끄지 않은) 막대 기준으로 맞춘다.
  let maxCount = 0;
  let total = 0;
  let selectedCount = 0;
  counts.forEach((row, i) => {
    row.forEach((c, g) => {
      if (c === 0) return;
      const point = histogramMarkPoint(bins, i, g, groupCount, c);
      if (off[legendIndexOf(g, point)]) return;
      maxCount = Math.max(maxCount, c);
      total += c;
      if (inSelection?.(...point)) selectedCount++;
    });
  });

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);

  const y = scaleLinear().domain(view?.y ?? [0, Math.max(1, maxCount)]);
  if (!view) y.nice(5);
  const yTicks = y.ticks(5).filter((t) => Number.isInteger(t));
  const yFormat = y.tickFormat(5);
  const yLabelWidth = labelWidth(ctx, yTicks.map(yFormat));
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend);
  y.range([plot.top + plot.height, plot.top]);
  const fullX: [number, number] = [bins.lo, bins.lo + bins.step * bins.count];
  const {
    scale: x,
    ticks: xTicks,
    format: xFormat,
  } = xAxis(
    "number",
    view?.x ?? fullX,
    [plot.left, plot.left + plot.width],
    false,
  );
  progress("aggregate", 1);

  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawYGrid(ctx, plot, y, yTicks, yFormat);
    ctx.fillStyle = THEME.textSecondary;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of xTicks) {
      ctx.fillText(
        xFormat(t),
        Math.round(x(t)) + 0.5,
        plot.top + plot.height + 7,
      );
    }
    drawBaseline(ctx, plot, y(0));
    drawTitle(ctx, plot, input.title, [
      `${total.toLocaleString()}개 값`,
      `${bins.count}개 구간`,
      inSelection && `${selectedCount}개 선택`,
    ]);
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, yLabelWidth)
      : undefined;
  }

  // ── 막대 (render) ───────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  const zero = y(0);
  counts.forEach((row, i) => {
    const left = x(bins.lo + bins.step * i);
    const right = x(bins.lo + bins.step * (i + 1));
    const gap = right - left > 4 ? BIN_GAP : 0;
    const slot = (right - left - gap) / groupCount;
    row.forEach((c, g) => {
      if (c === 0) return;
      const point = histogramMarkPoint(bins, i, g, groupCount, c);
      const index = legendIndexOf(g, point);
      if (off[index]) return;
      const top = y(c);
      ctx.fillStyle = colorOf(index);
      ctx.globalAlpha = !inSelection || inSelection(...point) ? 1 : 0.2;
      ctx.fillRect(
        left + gap / 2 + slot * g,
        top,
        Math.max(1, slot - (groupCount > 1 ? 1 : 0)),
        Math.max(1, zero - top),
      );
    });
    if (i % 20 === 0) progress("render", i / counts.length);
  });
  ctx.globalAlpha = 1;
  if (input.selection) {
    drawSelection(ctx, input.selection, x, y, THEME.selection);
  }
  drawShapes(ctx, input.shapes, x, y);
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "histogram",
    plot,
    x: { kind: "number", domain: [x.domain()[0], x.domain()[1]] },
    y: { kind: "number", domain: [y.domain()[0], y.domain()[1]] },
    bins,
    counts,
    groupCount,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
