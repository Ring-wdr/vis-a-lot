// bar / boxplot 렌더러. x축은 범주 인덱스(0, 1, 2 …)를 연속 좌표로 쓴다.
// 그래서 확대(인덱스 범위)와 데이터 좌표 도형이 scatter와 같은 방식으로 동작한다.
// legend가 있으면 범주 하나 안에 legend 값별 막대/상자를 나란히 놓는다.

import { scaleLinear } from "d3-scale";
import type { BoxStats } from "../data/category-data";
import { AGG_LABELS, type AggFn } from "../data/schema";
import { compileExpression } from "./analytics/expression";
import { focusTest } from "./analytics/focus";
import { outlierBounds } from "./analytics/outlier";
import { drawAxisTitles, drawYAxis, valueScale } from "./axis-style";
import {
  drawBaseline,
  drawCategoryLabels,
  drawTitle,
  labelWidth,
} from "./frame";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { type ChartOptions, optionsOf, type ShapeOptions } from "./options";
import { drawSelection, type Region, regionTester } from "./region";
import {
  type AxisMeta,
  compactPlot,
  type ItemView,
  type ProgressFn,
} from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import {
  alphaOf,
  createLabelGuard,
  drawPanel,
  drawPoint,
  drawPointLabel,
  fontPx,
  type LabelGuard,
  lineWidthOf,
  mixColor,
  pointSizeOf,
  surfaceOf,
} from "./style";
import { OTHERS_COLOR, THEME } from "./theme";

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
  /** 선택 영역 안에 든 막대/상자 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type CategoryInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
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
  /** 새 범례 영역. 막대 끝/상자 중앙값이 영역 안이면 legend 끝에 덧붙인 항목 색으로 칠한다. */
  groups?: readonly Region[];
  /** 선택 영역. 바깥 막대/상자는 흐리게 그린다. */
  selection?: Region;
  /** 섬네일: 축·제목·legend 없이 그림 영역만 그린다. */
  compact?: boolean;
  /** 축 제목(axes.*.title.visible)에 쓰는 이름. 보통 x·y 컬럼 라벨 */
  axisTitles?: { x?: string; y?: string };
};

type Ctx = OffscreenCanvasRenderingContext2D;

const RADIUS = 4;
const MARK_RATIO = 0.7;
/** 나란히 놓은 막대 사이 배경색 간격 */
const GROUP_GAP = 2;

// ── 막대 계열(bar·boxplot·histogram·waterfall)이 함께 쓰는 속성 조각 ─────────────

/** 회전한 범주 글자가 차지하는 폭 (framePlot이 아래 여백을 정한다). 돌리지 않으면 undefined */
export function rotatedLabelWidth(
  ctx: Ctx,
  labels: string[],
  o: ChartOptions,
): number | undefined {
  const axis = o.axes.x;
  if (!axis.label.angle || !axis.visible || !axis.label.visible)
    return undefined;
  ctx.font = `${fontPx(o, 11, axis.label.fontSize)}px ${THEME.font}`;
  return Math.min(
    80,
    Math.max(...labels.map((l) => ctx.measureText(l).width), 1),
  );
}

/**
 * 막대 하나(사각형)를 shape 속성으로 그린다. both: 채우기 + borderWidth 테두리(색을 조금 어둡게),
 * border: 테두리만, brush: 채우기만. 기본값(both, 테두리 0)은 지금처럼 채우기만 한다.
 * path는 부르는 쪽이 만들어 둔다.
 */
export function paintMark(ctx: Ctx, shape: ShapeOptions, color: string) {
  if (shape.style !== "border") {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (shape.style === "border") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, shape.borderWidth);
    ctx.stroke();
  } else if (shape.style === "both" && shape.borderWidth > 0) {
    ctx.strokeStyle = mixColor(color, "#000000", 0.3);
    ctx.lineWidth = shape.borderWidth;
    ctx.stroke();
  }
}

/**
 * 점 글자(pointLabel)를 그림 영역 안 막대에만 단다. clip 밖에서 부르므로 영역을 벗어난 점은 건너뛴다.
 * 꺼져 있으면 아무것도 하지 않는다.
 */
export function markLabeler(ctx: Ctx, plot: Plot, o: ChartOptions) {
  if (!o.pointLabel.visible) return undefined;
  const guard: LabelGuard = createLabelGuard();
  const font = fontPx(o, 10, o.pointLabel.fontSize);
  return (x: number, y: number, value: number) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < plot.left ||
      x > plot.left + plot.width ||
      y < plot.top - 1 ||
      y > plot.top + plot.height + 1
    )
      return;
    drawPointLabel(ctx, x, y, value, o.pointLabel, font, guard);
  };
}

type Plot = { left: number; top: number; width: number; height: number };

/**
 * 값 축(y). min·max·log·눈금 개수·소수 자리를 따르고, 확대(view)가 있으면 확대 범위가 이긴다.
 * 로그 축이면 0 이하 값은 그릴 수 없어 기준선은 축 아래 끝이다.
 */
export function categoryValueAxis(
  domain: [number, number],
  view: ItemView | undefined,
  o: ChartOptions,
  range: [number, number] = [1, 0],
) {
  return valueScale(view?.y ?? domain, range, o.axes.y, {
    nice: !view,
    zoomed: view !== undefined,
  });
}

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

/**
 * 범주 i의 g번째 막대/상자를 대표하는 데이터 좌표. x는 범주 인덱스 공간에서 그 막대/상자의 가운데,
 * y는 막대 끝 값이나 상자 중앙값이다. 선택·새 범례 영역 판정에 쓴다.
 */
export function markPoint(
  i: number,
  g: number,
  groupCount: number,
  value: number,
): [number, number] {
  return [i - MARK_RATIO / 2 + (MARK_RATIO / groupCount) * (g + 0.5), value];
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

/**
 * value·expression 구역을 집계값에 적용한 입력. bar는 빈 칸을 nullNumeric으로 채우고, 이상치 범위 밖 막대를 빼고,
 * y 식을 막대 값에 적용한다(x는 범주 인덱스). boxplot은 이상치를 켜면 이상치 점을 빼고 그린다.
 */
export function applyValueOptions(input: CategoryInput): CategoryInput {
  const o = optionsOf(input);
  if (input.chartType === "boxplot") {
    if (!o.value.outlier) return input;
    return {
      ...input,
      boxes: input.boxes?.map((row) =>
        row.map((b) => b && { ...b, outliers: [] }),
      ),
    };
  }
  let bars = input.bars;
  if (!bars) return input;
  const { nullNumeric } = o.value;
  if (nullNumeric !== null)
    bars = bars.map((row) => row.map((v) => v ?? nullNumeric));
  if (o.value.outlier) {
    const values = bars.flat().filter((v): v is number => v !== null);
    const [lo, hi] = outlierBounds(
      values,
      o.value.outlierMethod,
      o.value.outlierK,
    );
    bars = bars.map((row) =>
      row.map((v) => (v === null || (v >= lo && v <= hi) ? v : null)),
    );
  }
  const expr = o.expression.y.trim() ? compileExpression(o.expression.y) : null;
  if (expr?.ok) {
    const { fn } = expr;
    bars = bars.map((row, i) =>
      row.map((v) => {
        if (v === null) return null;
        const out = fn(i, v);
        return Number.isFinite(out) ? out : null;
      }),
    );
  }
  return bars === input.bars ? input : { ...input, bars };
}

export function renderCategory(
  ctx: Ctx,
  rawInput: CategoryInput,
  progress: ProgressFn,
): CategoryMeta {
  const input = applyValueOptions(rawInput);
  const o = optionsOf(input);
  const { width, height, categories, view } = input;
  const n = categories.length;
  const groups = (input.groups ?? []).map(regionTester);
  // 새 범례 항목은 legend 끝에 붙어 있다. 막대/상자 자리는 원래 legend 값 수만큼만 나눈다.
  const groupCount = Math.max(
    1,
    (input.legend?.values.length ?? 1) - groups.length,
  );
  const inSelection = input.selection && regionTester(input.selection);
  let selectedCount = 0;

  /** 막대/상자의 legend 인덱스. 새 범례 영역 안이면 덧붙인 항목이다. */
  const legendIndexOf = (g: number, point: readonly [number, number]) => {
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](point[0], point[1])) return groupCount + k;
    }
    return g;
  };
  // focus: 조건에 맞는 막대/상자(x = 범주 인덱스, y = 막대 값·중앙값)는 focus 색, legendSingleColor면 나머지는 회색
  const focus = o.focus.enabled ? focusTest(o.focus) : undefined;
  const colorOf = (index: number, point?: readonly [number, number], i = 0) => {
    if (focus && point) {
      if (focus(i, point[1])) return o.focus.color;
      if (o.focus.legendSingleColor) return OTHERS_COLOR;
    }
    return input.legend?.colors[index] ?? input.color;
  };
  // 체크박스로 끈 legend 값의 막대/상자는 그리지 않는다.
  const off = hiddenIndexes(input.legend);
  /** 선택이 있으면 바깥 막대/상자는 흐리게 */
  const selectionAlpha = (point: readonly [number, number]) =>
    !inSelection || inSelection(point[0], point[1]) ? 1 : 0.2;
  /** 막대는 끝 값, 상자는 중앙값이 대표 값이다. */
  const markValue = (i: number, g: number) =>
    input.chartType === "bar"
      ? (input.bars?.[i]?.[g] ?? null)
      : (input.boxes?.[i]?.[g]?.median ?? null);
  if (inSelection) {
    for (let i = 0; i < n; i++) {
      for (let g = 0; g < groupCount; g++) {
        const v = markValue(i, g);
        if (v === null) continue;
        const point = markPoint(i, g, groupCount, v);
        if (!off[legendIndexOf(g, point)] && inSelection(...point))
          selectedCount++;
      }
    }
  }

  drawPanel(ctx, width, height, o);

  // ── 축 (aggregate) ────────────────────────────────────────────
  const extent = valueExtent(input);
  const { ticks: yTicks, format: yFormat } = categoryValueAxis(extent, view, o);
  const yLabelWidth = labelWidth(
    ctx,
    yTicks.map(yFormat),
    fontPx(o, 11, o.axes.y.label.fontSize),
  );
  const xLabelWidth = rotatedLabelWidth(ctx, categories, o);
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend, o, xLabelWidth);
  const { scale: y, log: yLog } = categoryValueAxis(extent, view, o, [
    plot.top + plot.height,
    plot.top,
  ]);
  /** 막대가 시작하는 기준선. 로그 축이면 0이 없어 축 아래 끝 */
  const baseValue = yLog ? y.domain()[0] : 0;

  const xDomain: [number, number] = view?.x ?? [-0.5, Math.max(0, n - 1) + 0.5];
  const x = scaleLinear()
    .domain(xDomain)
    .range([plot.left, plot.left + plot.width]);
  const band = plot.width / (xDomain[1] - xDomain[0]);
  const markWidth = Math.max(1, band * MARK_RATIO);
  progress("aggregate", 1);

  // ── 그리드와 축, 제목, legend (섬네일은 그림 영역만 그린다) ───────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawYAxis(ctx, plot, y, yTicks, yFormat, o);
    // 보이는 범주만 라벨을 달고, 겹치면 건너뛴다.
    drawCategoryLabels(ctx, plot, x, categories, xDomain, band, o);
    drawBaseline(
      ctx,
      plot,
      y(input.chartType === "bar" ? baseValue : y.domain()[0]),
      o,
    );
    drawAxisTitles(
      ctx,
      plot,
      o,
      input.axisTitles ?? {},
      yLabelWidth,
      xLabelWidth,
    );

    // ── 제목 ──────────────────────────────────────────────────────
    drawTitle(
      ctx,
      plot,
      input.title,
      [
        input.chartType === "bar" && input.agg ? AGG_LABELS[input.agg] : "",
        `${n}개 범주`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );

    // ── legend ────────────────────────────────────────────────────
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, yLabelWidth, o)
      : undefined;
  }

  // ── 막대 / 상자 (render) ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  /** 점 글자 자리: [x, y, 값]. clip을 푼 뒤 그린다. */
  const labels: [number, number, number][] = [];
  const { shape } = o;
  if (input.chartType === "bar") {
    const zero = y(baseValue);
    const fill = alphaOf(shape.transparency, 1);
    (input.bars ?? []).forEach((row, i) => {
      row.forEach((v, g) => {
        if (v === null) return;
        // 로그 축에서 0 이하 값은 그릴 자리가 없다.
        if (yLog && v <= 0) return;
        const { cx, width: w } = groupSlot(x(i), markWidth, groupCount, g);
        const top = Math.min(y(v), zero);
        const h = Math.abs(y(v) - zero);
        const r = Math.min(RADIUS, w / 2, h);
        // 데이터 끝(바깥쪽)만 둥글게, 기준선 쪽은 각지게 둔다.
        const radii = v >= 0 ? [r, r, 0, 0] : [0, 0, r, r];
        const point = markPoint(i, g, groupCount, v);
        const index = legendIndexOf(g, point);
        if (off[index]) return;
        ctx.globalAlpha = selectionAlpha(point) * fill;
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, top, w, Math.max(h, 1), radii);
        paintMark(ctx, shape, colorOf(index, point, i));
        ctx.globalAlpha = 1;
        labels.push([cx, y(v), v]);
      });
      if (i % 200 === 0) progress("render", i / n);
    });
  } else {
    (input.boxes ?? []).forEach((row, i) => {
      row.forEach((b, g) => {
        if (!b) return;
        const { cx, width: w } = groupSlot(x(i), markWidth, groupCount, g);
        const half = w / 2;
        const point = markPoint(i, g, groupCount, b.median);
        const index = legendIndexOf(g, point);
        if (off[index]) return;
        const color = colorOf(index, point, i);
        const alpha = selectionAlpha(point);
        const line = lineWidthOf(o, 1.5);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = line;
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
        // shape: brush는 테두리 없이 채우기만, border는 테두리만. 테두리 굵기를 정했으면 그 굵기
        const top = y(b.q3);
        const h = Math.max(1, y(b.q1) - top);
        if (shape.style !== "border") {
          ctx.globalAlpha = alphaOf(shape.transparency, 0.22) * alpha;
          ctx.fillStyle = color;
          ctx.fillRect(cx - half, top, w, h);
        }
        ctx.globalAlpha = alpha;
        if (shape.style !== "brush") {
          ctx.lineWidth = shape.borderWidth > 0 ? shape.borderWidth : line;
          ctx.strokeRect(cx - half, top, w, h);
        }
        // 중앙값
        ctx.strokeStyle = THEME.textPrimary;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - half, y(b.median));
        ctx.lineTo(cx + half, y(b.median));
        ctx.stroke();
        // 이상치: shape 모양·크기를 따른다. 기본은 반지름 2 원, 투명도 0.6
        ctx.globalAlpha = alphaOf(shape.transparency, 0.6) * alpha;
        const radius = pointSizeOf(o, 2);
        for (const v of b.outliers) {
          drawPoint(
            ctx,
            shape.type,
            cx,
            y(v),
            radius,
            shape.style,
            shape.borderWidth,
            color,
            surfaceOf(o),
          );
        }
        ctx.globalAlpha = 1;
        labels.push([cx, y(b.median), b.median]);
      });
      if (i % 50 === 0) progress("render", i / n);
    });
  }
  if (input.selection) {
    drawSelection(
      ctx,
      input.selection,
      (v) => x(v),
      (v) => y(v),
      THEME.selection,
    );
  }
  drawShapes(
    ctx,
    input.shapes,
    (v) => x(v),
    (v) => y(v),
  );
  ctx.restore();
  // 점 글자: 막대 끝 값, 상자는 중앙값
  const label = input.compact ? undefined : markLabeler(ctx, plot, o);
  if (label) for (const [lx, ly, v] of labels) label(lx, ly, v);
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
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
