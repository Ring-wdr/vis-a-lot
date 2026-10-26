// scatter 렌더러. 캔버스에 그리고, 툴팁에 쓸 metadata(축 정보 + 픽셀 기준으로 줄인 점)를 만든다.
// 캔버스 2D 컨텍스트만 있으면 되므로 Worker든 Node(skia-canvas 등)든 그대로 돈다.

import { extent } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { utcFormat } from "d3-time-format";
import { compileExpression } from "./analytics/expression";
import { focusTest } from "./analytics/focus";
import { keepMask, outlierBounds } from "./analytics/outlier";
import { type PredictionResult, predict } from "./analytics/prediction";
import { computeScores, type ScoreResult } from "./analytics/score";
import {
  drawAxisTitles,
  drawXAxis,
  drawYAxis,
  numberFormat,
  timeFormat,
  valueScale,
} from "./axis-style";
import { drawTitle, labelWidth } from "./frame";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { drawLines, seriesOrder } from "./line";
import {
  type AxisOptions,
  type ChartOptions,
  DEFAULT_OPTIONS,
  optionsOf,
} from "./options";
import { drawSelection, type Region, regionTester } from "./region";
import { drawShapes, type Shape } from "./shapes";
import {
  alphaOf,
  createLabelGuard,
  drawPanel,
  drawPoint,
  drawPointLabel,
  fontPx,
  lineWidthOf,
  mixColor,
  pathPoint,
  pointSizeOf,
  surfaceOf,
} from "./style";
import { OTHERS_COLOR, THEME } from "./theme";

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

export type AxisKind = "number" | "time";

export type AxisMeta = {
  kind: AxisKind;
  /** 데이터 값 기준 범위 (시계열은 epoch ms) */
  domain: [number, number];
  /** 로그 축으로 그렸는지 (axes.log). 없으면 선형 */
  log?: boolean;
};

/** line도 같은 행 단위 점을 쓰므로 metadata 모양이 같다. */
export type ScatterMeta = {
  chartType: "scatter" | "line";
  /** PNG 안에서 그림 영역의 픽셀 범위 */
  plot: { left: number; top: number; width: number; height: number };
  x: AxisMeta;
  y: AxisMeta;
  /** 같은 픽셀 칸에 겹친 점은 첫 점만 남긴다. px/py는 PNG 좌표, x/y는 데이터 값이다. */
  points: {
    px: number[];
    py: number[];
    x: number[];
    y: number[];
    id: number[];
    /** legend 인덱스 (legend가 있을 때만) */
    g?: number[];
  };
  total: number;
  /** 선택 영역 안에 든 점 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
  /** score 구역을 켰을 때 계산한 점수 (그린 점 기준) */
  scores?: ScoreResult[];
};

export type ScatterInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  /** line이면 점 대신 legend 계열별로 x 순 점을 선으로 잇는다. 없으면 scatter */
  chartType?: "scatter" | "line";
  width: number;
  height: number;
  title: string;
  xKind: AxisKind;
  xs: Float64Array;
  ys: Float64Array;
  ids: Float64Array;
  color: string;
  /** legend가 있으면 점마다 legend 인덱스로 색을 고른다. */
  legend?: LegendInput & { index: Uint8Array };
  /**
   * 새 범례 영역. 영역 안의 점은 legend 끝에 덧붙인 항목(legend.values의 뒤쪽)으로 칠한다.
   * 겹치면 나중 영역이 이긴다.
   */
  groups?: readonly Region[];
  /** 선택 영역. 바깥 점은 흐리게 그린다. */
  selection?: Region;
  /** 지운 영역. 안의 점은 없던 것으로 보고 그리지도, 세지도 않는다. */
  deletions?: readonly Region[];
  /** 확대한 범위. 없으면 데이터 전체 범위를 보기 좋게 맞춘다. */
  view?: ItemView;
  shapes: readonly Shape[];
  /** 섬네일: 축·제목·legend 없이 그림 영역만 그린다. */
  compact?: boolean;
  /** 축 제목(axes.title.visible이고 글자를 비웠을 때)으로 쓰는 컬럼 이름. 없으면 x, y */
  xTitle?: string;
  yTitle?: string;
};

export type ItemView = { x: [number, number]; y: [number, number] };

export type RenderStage = "aggregate" | "render";
export type ProgressFn = (stage: RenderStage, ratio: number) => void;

type Ctx = OffscreenCanvasRenderingContext2D;

const CHUNK = 50_000;
/** 점 크기 자동일 때 scatter 점 반지름 (CSS 픽셀) */
const POINT_RADIUS = 3;
/** 크기 자동일 때 점이 영역을 이보다 여러 겹 덮으면 점을 줄인다 (작은 칸에 점이 아주 많을 때). */
const MAX_COVERAGE = 30;
/** 같은 색 점을 한 픽셀 칸에 겹쳐 그리는 최대 수. 밀도는 남기고 행이 많을 때 그리는 양을 묶는다. */
const MAX_PER_CELL = 3;
const MIN_POINT_RADIUS = 1.5;

/** 값이 하나뿐일 때 양쪽으로 벌리는 폭. 시계열은 1ms가 아니라 앞뒤 1분을 보여준다. */
const SINGLE_VALUE_PAD = { number: 1, time: 60_000 } as const;

export function niceDomain(
  values: Float64Array,
  kind: AxisKind = "number",
): [number, number] {
  const [min, max] = extent(values) as [number | undefined, number | undefined];
  if (min === undefined || max === undefined) return [0, 1];
  if (min === max)
    return [min - SINGLE_VALUE_PAD[kind], max + SINGLE_VALUE_PAD[kind]];
  return [min, max];
}

/** 시계열 눈금 글자: 보이는 범위가 좁을수록 초·밀리초까지 적어 눈금끼리 같은 글자가 되지 않게 한다. */
export function timeFormatter(domain: [number, number]) {
  const span = domain[1] - domain[0];
  const fmt = utcFormat(
    span > 2 * DAY_MS
      ? "%m/%d"
      : span > DAY_MS / 4
        ? "%m/%d %H시"
        : span > 10 * 60_000
          ? "%H:%M"
          : span > 5_000
            ? "%H:%M:%S"
            : "%H:%M:%S.%L",
  );
  // 축은 KST로 읽히게 한다.
  return (v: number) => fmt(new Date(v + KST_OFFSET_MS));
}

/** 섬네일의 그림 영역: 여백만 조금 두고 전부 쓴다. */
export function compactPlot(width: number, height: number) {
  const pad = 4;
  return {
    left: pad,
    top: pad,
    width: Math.max(10, width - pad * 2),
    height: Math.max(10, height - pad * 2),
  };
}

/** keep이 1인 행만 남긴 입력 (x·y·행 id·legend 인덱스를 함께 줄인다) */
function keepRows(input: ScatterInput, mask: Uint8Array): ScatterInput {
  const { xs, ys, ids, legend } = input;
  const keep: number[] = [];
  for (let i = 0; i < xs.length; i++) if (mask[i]) keep.push(i);
  if (keep.length === xs.length) return input;
  const pick = <T extends Float64Array | Uint8Array>(src: T, out: T) => {
    keep.forEach((k, j) => {
      out[j] = src[k];
    });
    return out;
  };
  return {
    ...input,
    xs: pick(xs, new Float64Array(keep.length)),
    ys: pick(ys, new Float64Array(keep.length)),
    ids: pick(ids, new Float64Array(keep.length)),
    legend: legend && {
      ...legend,
      index: pick(legend.index, new Uint8Array(keep.length)),
    },
  };
}

/** 지운 영역 안의 점을 뺀 입력. 지운 영역이 없으면 그대로 돌려준다. */
export function withoutDeleted(input: ScatterInput): ScatterInput {
  const tests = (input.deletions ?? []).map(regionTester);
  if (tests.length === 0) return input;
  const { xs, ys } = input;
  const mask = new Uint8Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    mask[i] = tests.some((inside) => inside(xs[i], ys[i])) ? 0 : 1;
  }
  return keepRows(input, mask);
}

/**
 * expression 구역: x·y 식을 값에 적용한다 (식 안에서 x, y는 원래 값). 결과가 NaN·무한이면 그 행은 뺀다.
 * 식이 틀리면 데이터를 그대로 두고 오류 글자를 돌려준다. 빈 식은 그 축을 바꾸지 않는다.
 */
export function withExpression(
  input: ScatterInput,
  expression: ChartOptions["expression"],
): { input: ScatterInput; error?: string } {
  const sources = [expression.x.trim(), expression.y.trim()];
  if (!sources[0] && !sources[1]) return { input };
  const compiled = sources.map((src) => (src ? compileExpression(src) : null));
  for (const [k, c] of compiled.entries()) {
    if (c && !c.ok)
      return { input, error: `${k === 0 ? "x" : "y"} 식: ${c.error}` };
  }
  const fx = compiled[0]?.ok ? compiled[0].fn : null;
  const fy = compiled[1]?.ok ? compiled[1].fn : null;
  const { xs, ys } = input;
  const nx = new Float64Array(xs.length);
  const ny = new Float64Array(ys.length);
  const mask = new Uint8Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const x = fx ? fx(xs[i], ys[i]) : xs[i];
    const y = fy ? fy(xs[i], ys[i]) : ys[i];
    nx[i] = x;
    ny[i] = y;
    mask[i] = Number.isFinite(x) && Number.isFinite(y) ? 1 : 0;
  }
  return { input: keepRows({ ...input, xs: nx, ys: ny }, mask) };
}

/** value 구역의 이상치: y가 범위 밖인 행을 뺀다. 뺀 수를 함께 돌려준다. */
export function withoutOutliers(
  input: ScatterInput,
  value: ChartOptions["value"],
): { input: ScatterInput; removed: number } {
  if (!value.outlier || input.ys.length === 0) return { input, removed: 0 };
  const mask = keepMask(
    input.ys,
    outlierBounds(input.ys, value.outlierMethod, value.outlierK),
  );
  const out = keepRows(input, mask);
  return { input: out, removed: input.ys.length - out.ys.length };
}

/** x축 눈금 개수를 폭에서 정하는 기본값. tick.count를 바꾸면 그 값을 쓴다. */
const DEFAULT_TICK_COUNT = DEFAULT_OPTIONS.axes.x.tick.count;

/**
 * x축: 위치는 시계열도 숫자(epoch ms) 선형 축으로 계산한다. scaleUtc는 범위를 Date로 바꾸며
 * 밀리초 아래를 버려서, 1ms보다 좁게 확대하면 점이 한쪽 끝으로 밀려 보였다.
 * 시계열은 눈금 자리와 글자만 scaleUtc에서 받는다. nice는 확대하지 않은 숫자 축에만 건다.
 * axis(axes.x)가 있으면 숫자 축에 min·max·log·소수 자리를, 시계열에 dateFormat을 쓴다.
 * nice가 false(확대 중)면 min·max보다 확대 범위가 이긴다. min·max는 숫자 축에만 쓴다.
 */
export function xAxis(
  kind: AxisKind,
  domain: [number, number],
  range: [number, number],
  nice: boolean,
  axis: AxisOptions = DEFAULT_OPTIONS.axes.x,
) {
  const count =
    axis.tick.count === DEFAULT_TICK_COUNT
      ? Math.max(2, Math.floor((range[1] - range[0]) / 90))
      : Math.max(1, Math.round(axis.tick.count));
  if (kind !== "time") {
    if (axis.log) {
      const v = valueScale(domain, range, axis, { nice, zoomed: !nice });
      if (v.log)
        return { scale: v.scale, ticks: v.ticks, format: v.format, log: true };
    }
    let d = domain;
    const fixed = nice && (axis.min !== null || axis.max !== null);
    if (fixed) {
      const fd: [number, number] = [axis.min ?? d[0], axis.max ?? d[1]];
      if (fd[0] < fd[1]) d = fd;
    }
    const scale = scaleLinear().domain(d).range(range);
    if (nice && !fixed) scale.nice(5);
    return {
      scale,
      ticks: scale.ticks(count),
      format: numberFormat(axis.decimals, scale.tickFormat(5)),
      log: false,
    };
  }
  const scale = scaleLinear().domain(domain).range(range);
  const ticks = scaleUtc()
    .domain(domain)
    .ticks(count)
    .map(Number)
    .filter((t) => t >= domain[0] && t <= domain[1]);
  return {
    scale,
    // 1ms보다 좁으면 눈금이 없을 수 있어 가운데 하나를 둔다.
    ticks: ticks.length > 0 ? ticks : [(domain[0] + domain[1]) / 2],
    format: timeFormat(axis.dateFormat, domain),
    log: false,
  };
}

/** 점 글자를 다는 최대 점 수 (픽셀로 줄인 뒤). 넘으면 글자를 달지 않는다. */
export const MAX_LABEL_POINTS = 3000;

/** 예측 한 계열: 그릴 색과 결과 */
type Forecast = {
  color: string;
  result: PredictionResult;
  lastX: number;
  lastY: number;
};

/**
 * prediction 구역. line은 legend 계열마다, scatter는 전체 점을 x 순으로 한 계열로 예측한다.
 * 끈 legend 값은 뺀다.
 */
function forecasts(
  input: ScatterInput,
  o: ChartOptions,
  groupIndex: Uint8Array | undefined,
  off: readonly boolean[],
): Forecast[] {
  if (!o.prediction.enabled || input.xs.length === 0) return [];
  const { xs, ys, legend } = input;
  const perSeries = input.chartType === "line";
  const count = perSeries && legend ? legend.colors.length : 1;
  const series = seriesOrder(
    xs,
    perSeries ? groupIndex : undefined,
    count,
    perSeries ? off : [],
  );
  const out: Forecast[] = [];
  series.forEach((order, g) => {
    let picked = order;
    if (!perSeries && groupIndex && off.some(Boolean)) {
      picked = order.filter((i) => !off[groupIndex[i]]);
    }
    if (picked.length === 0) return;
    const sx = new Float64Array(picked.length);
    const sy = new Float64Array(picked.length);
    picked.forEach((i, k) => {
      sx[k] = xs[i];
      sy[k] = ys[i];
    });
    const result = predict(sx, sy, o.prediction);
    if (!result || result.xs.length === 0) return;
    const color =
      perSeries && legend
        ? legend.colors[g]
        : legend
          ? THEME.textSecondary
          : input.color;
    out.push({
      color,
      result,
      lastX: sx[sx.length - 1],
      lastY: sy[sy.length - 1],
    });
  });
  return out;
}

/** 예측 값까지 담도록 넓힌 범위 */
function extendDomain(
  domain: [number, number],
  values: Iterable<number>,
): [number, number] {
  let [lo, hi] = domain;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

function drawForecasts(
  ctx: Ctx,
  list: readonly Forecast[],
  x: (v: number) => number,
  y: (v: number) => number,
  lineWidth: number,
) {
  for (const { color, result, lastX, lastY } of list) {
    const { lower, upper } = result;
    if (lower && upper) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x(lastX), y(lastY));
      result.xs.forEach((v, k) => {
        ctx.lineTo(x(v), y(upper[k]));
      });
      for (let k = result.xs.length - 1; k >= 0; k--)
        ctx.lineTo(x(result.xs[k]), y(lower[k]));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x(lastX), y(lastY));
    result.xs.forEach((v, k) => {
      if (Number.isFinite(result.ys[k])) ctx.lineTo(x(v), y(result.ys[k]));
    });
    ctx.stroke();
    ctx.restore();
  }
}

/** score 상자: 그림 영역 오른쪽 위에 점수 한 줄씩 */
function drawScoreBox(
  ctx: Ctx,
  plot: { left: number; top: number; width: number; height: number },
  scores: readonly ScoreResult[],
  o: ChartOptions,
) {
  if (scores.length === 0) return;
  const s = o.score;
  const font = fontPx(o, 11, s.fontSize);
  ctx.save();
  ctx.font = `${font}px ${THEME.font}`;
  const pad = 6;
  const line = font + 4;
  const width =
    Math.max(...scores.map((r) => ctx.measureText(r.label).width)) + pad * 2;
  const height = scores.length * line + pad * 2 - 4;
  const bx = Math.round(plot.left + plot.width - width - 6) + 0.5;
  const by = Math.round(plot.top + 6) + 0.5;
  ctx.fillStyle = s.backColor;
  ctx.fillRect(bx, by, width, height);
  if (s.borderWidth > 0) {
    ctx.strokeStyle = s.borderColor;
    ctx.lineWidth = s.borderWidth;
    ctx.strokeRect(bx, by, width, height);
  }
  ctx.fillStyle = s.fontColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  scores.forEach((r, k) => {
    ctx.fillText(r.label, bx + pad, by + pad + k * line);
  });
  ctx.restore();
}

/** score 구역 계산: 그린 점(끈 legend 값 제외) 기준. fscore의 그룹은 legend 인덱스 */
function scoresOf(
  xs: Float64Array,
  ys: Float64Array,
  groupIndex: Uint8Array | undefined,
  off: readonly boolean[],
  o: ChartOptions,
): ScoreResult[] {
  const limits = { ucl: o.score.ucl, lcl: o.score.lcl };
  if (!groupIndex || !off.some(Boolean)) {
    return computeScores(o.score.kinds, { xs, ys, groups: groupIndex }, limits);
  }
  const keep: number[] = [];
  for (let i = 0; i < xs.length; i++) if (!off[groupIndex[i]]) keep.push(i);
  return computeScores(
    o.score.kinds,
    {
      xs: keep.map((i) => xs[i]),
      ys: keep.map((i) => ys[i]),
      groups: keep.map((i) => groupIndex[i]),
    },
    limits,
  );
}

/**
 * 좌표 기준: expression을 적용한 값이 곧 "데이터 좌표"다. 축 범위, metadata(points.x/y, 축 domain),
 * 확대 범위(view), 선택·지운 영역, 도형은 모두 이 변환된 값으로 다룬다. 식을 바꾸면 예전 영역은
 * 새 좌표에서 그대로 해석된다. 처리 순서: expression → 지운 영역 → 이상치(value) → 그리기.
 * value.nullNumeric은 행 단위 점 차트에 빈 칸이 없어 쓰지 않는다 (null 행은 조회에서 빠진다).
 */
export function renderScatter(
  ctx: Ctx,
  rawInput: ScatterInput,
  progress: ProgressFn,
): ScatterMeta {
  const o = optionsOf(rawInput);
  const expressed = withExpression(rawInput, o.expression);
  const cleaned = withoutOutliers(withoutDeleted(expressed.input), o.value);
  const input = cleaned.input;
  const { width, height, xs, ys } = input;
  const n = xs.length;

  drawPanel(ctx, width, height, o);

  // 점마다의 legend 인덱스. 새 범례 영역 안의 점은 덧붙인 항목으로 바꾼다.
  const groups = (input.groups ?? []).map(regionTester);
  const groupIndex = input.legend && new Uint8Array(input.legend.index);
  const groupBase = (input.legend?.values.length ?? 0) - groups.length;
  if (groupIndex && groups.length > 0) {
    for (let i = 0; i < n; i++) {
      for (let k = groups.length - 1; k >= 0; k--) {
        if (groups[k](xs[i], ys[i])) {
          groupIndex[i] = groupBase + k;
          break;
        }
      }
    }
  }
  // 체크박스로 끈 legend 값의 점은 그리지도, 툴팁으로 찾지도 않는다.
  const off = hiddenIndexes(input.legend);

  // ── 예측 (축 범위를 넓히므로 먼저) ─────────────────────────────
  const predicted = forecasts(input, o, groupIndex, off);

  // ── 축 범위와 눈금 (aggregate) ─────────────────────────────────
  const { view } = input;
  let xDomain = view?.x ?? niceDomain(xs, input.xKind);
  let yDomain = view?.y ?? niceDomain(ys);
  if (!view && predicted.length > 0) {
    xDomain = extendDomain(
      n > 0 ? xDomain : [Infinity, -Infinity],
      predicted.flatMap((f) => f.result.xs),
    );
    yDomain = extendDomain(
      n > 0 ? yDomain : [Infinity, -Infinity],
      predicted.flatMap((f) => [
        ...f.result.ys,
        ...(f.result.lower ?? []),
        ...(f.result.upper ?? []),
      ]),
    );
  }
  const yScaleAt = (range: [number, number]) =>
    valueScale(yDomain, range, o.axes.y, {
      nice: true,
      zoomed: view !== undefined,
    });
  // 눈금은 범위(픽셀)와 무관하다. 글자 폭으로 그림 영역을 정한 뒤 같은 축을 픽셀 범위로 다시 만든다.
  const { ticks: yTicks, format: yFormat } = yScaleAt([1, 0]);

  const yLabelWidth = labelWidth(
    ctx,
    yTicks.map((t) => yFormat(t)),
    fontPx(o, 11, o.axes.y.label.fontSize),
  );
  // x 눈금 글자를 돌리면 가장 긴 글자 폭만큼 아래를 비운다 (양 끝 값으로 어림한다).
  const xLabelWidth = o.axes.x.label.angle
    ? labelWidth(
        ctx,
        [xDomain[0], xDomain[1]].map(
          xAxis(input.xKind, xDomain, [0, 1], !view, o.axes.x).format,
        ),
        fontPx(o, 11, o.axes.x.label.fontSize),
      )
    : undefined;
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend, o, xLabelWidth);
  const yAxis = yScaleAt([plot.top + plot.height, plot.top]);
  const y = yAxis.scale;

  const {
    scale: x,
    ticks: xTicks,
    format: xFormat,
    log: xLog,
  } = xAxis(
    input.xKind,
    xDomain,
    [plot.left, plot.left + plot.width],
    !view,
    o.axes.x,
  );

  // focus 구역: 조건에 맞는 점은 맨 위에 focus 색·모양·크기로 다시 그린다.
  const focus = o.focus.enabled ? focusTest(o.focus) : undefined;
  const focused = focus ? new Uint8Array(n) : undefined;

  // 픽셀 단위로 점을 줄인다. 툴팁의 "가장 가까운 점"은 이 점들 안에서 찾는다.
  const cell = new Int32Array(plot.width * plot.height).fill(-1);
  const px: number[] = [];
  const py: number[] = [];
  const keptX: number[] = [];
  const keptY: number[] = [];
  const keptId: number[] = [];
  const keptG: number[] = [];
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const { selection } = input;
  const inSelection = selection && regionTester(selection);
  const selected = selection ? new Uint8Array(n) : undefined;
  let selectedCount = 0;
  let focusedCount = 0;
  for (let i = 0; i < n; i++) {
    if (inSelection && selected && inSelection(xs[i], ys[i])) {
      selected[i] = 1;
      selectedCount++;
    }
    const cx = x(xs[i]);
    const cy = y(ys[i]);
    sx[i] = cx;
    sy[i] = cy;
    if (groupIndex && off[groupIndex[i]]) continue;
    if (focused && focus?.(xs[i], ys[i])) {
      focused[i] = 1;
      focusedCount++;
    }
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
        keptId.push(input.ids[i]);
        if (groupIndex) keptG.push(groupIndex[i]);
      }
    }
    if (i % CHUNK === 0) progress("aggregate", i / n);
  }
  progress("aggregate", 1);

  const scores =
    o.score.visible && o.score.kinds.length > 0
      ? scoresOf(xs, ys, groupIndex, off, o)
      : undefined;

  // ── 그리드와 축, 제목, legend (섬네일은 그림 영역만 그린다) ───────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawYAxis(ctx, plot, y, yTicks, yFormat, o);
    drawXAxis(ctx, plot, x, xTicks, xFormat, o);
    drawAxisTitles(
      ctx,
      plot,
      o,
      { x: input.xTitle ?? "x", y: input.yTitle ?? "y" },
      yLabelWidth,
      xLabelWidth,
    );

    // ── 제목 ──────────────────────────────────────────────────────
    drawTitle(
      ctx,
      plot,
      input.title,
      [
        expressed.error,
        cleaned.removed > 0 &&
          `이상치 ${cleaned.removed.toLocaleString()} 제외`,
        selection
          ? `${selectedCount.toLocaleString()} / ${n.toLocaleString()} pts 선택`
          : `${n.toLocaleString()} pts`,
      ],
      o,
    );

    // ── legend ────────────────────────────────────────────────
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, yLabelWidth, o)
      : undefined;
  }

  // ── 점 (render) ───────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  // legendSingleColor: 조건에 맞지 않는 점은 legend 색 대신 회색 한 가지로 그린다.
  const single = focus && o.focus.legendSingleColor;
  const surface = surfaceOf(o);
  const { shape } = o;
  if (n === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  } else if (input.chartType === "line") {
    progress("render", 0);
    const count = input.legend ? input.legend.colors.length : 1;
    drawLines(ctx, {
      sx,
      sy,
      series: seriesOrder(xs, groupIndex, count, off),
      colors: single
        ? new Array(count).fill(OTHERS_COLOR)
        : input.legend
          ? input.legend.colors
          : [input.color],
      selected,
      plot,
      compact: input.compact,
      lineWidth: lineWidthOf(o, input.compact ? 1 : 1.5),
      alpha: alphaOf(shape.transparency, 1),
      dot: {
        shape: shape.type,
        radius: pointSizeOf(o, 2.5),
        style: shape.style,
        borderWidth: shape.borderWidth,
        stroke: surface,
      },
    });
  } else {
    // legend 값마다 한 번씩 훑으며 그 색의 점만 그린다 (뒤 legend 값이 위에 온다).
    const { legend } = input;
    const passes = legend ? legend.colors : [input.color];
    // 선택이 있으면 바깥 점(0)을 먼저 흐리게, 안쪽 점(1)을 그 위에 그린다.
    const layers = selected ? [0, 1] : [1];
    const area = Math.max(1, plot.width * plot.height);
    // 실제로 그릴 점 수 (칸마다 상한까지). 겹침 정도를 이 수로 잰다.
    const drawable = Math.min(n, px.length * MAX_PER_CELL);
    /** 반지름 r 점이 그림 영역을 몇 겹 덮는지 (픽셀로 줄인 점 수 × 점 넓이 / 영역 넓이) */
    const coverageAt = (r: number) => (drawable * Math.PI * r * r) / area;
    // 크기 자동: 기본 반지름 3, 영역을 너무 여러 겹 덮으면 그만큼 줄인다(최소 1.5).
    const autoRadius = input.compact
      ? 1.5
      : Math.max(
          MIN_POINT_RADIUS,
          POINT_RADIUS *
            Math.min(1, Math.sqrt(MAX_COVERAGE / coverageAt(POINT_RADIUS))),
        );
    const radius = pointSizeOf(o, autoRadius);
    // 기본 모양(원·채우기+테두리·테두리 0)은 불투명 채우기에 같은 색을 진하게 한 1px 테두리를 둘러
    // 겹쳐도 원 하나하나가 보이게 한다. 섬네일은 점이 작아 테두리 없이 그린다.
    const plain =
      shape.type === "circle" &&
      shape.style === "both" &&
      shape.borderWidth === 0;
    const borderWidth = plain ? (input.compact ? 0 : 1) : shape.borderWidth;
    // 투명도 0(자동)은 불투명이다. 전체 설정의 값을 그대로 따른다.
    const alpha = alphaOf(shape.transparency, 1);
    // 같은 색 안에서 픽셀 칸마다 그린 점 수. 상한을 넘으면 더 칠해도 거의 같아 보여 건너뛴다.
    const drawn = new Uint8Array(plot.width * plot.height);
    // 그림 영역 밖이어도 점 반지름만큼은 영역 안으로 걸쳐 보인다.
    const reach = radius + borderWidth;
    const steps = layers.length * passes.length;
    layers.forEach((layer, l) => {
      passes.forEach((passColor, g) => {
        if (off[g]) return;
        const color = single ? OTHERS_COLOR : passColor;
        ctx.globalAlpha = layer === 0 ? alpha * 0.2 : alpha;
        if (plain) {
          ctx.fillStyle = color;
          ctx.strokeStyle = mixColor(color, "#000000", 0.25);
          ctx.lineWidth = borderWidth;
        }
        drawn.fill(0);
        for (let i = 0; i < n; i++) {
          if (groupIndex && groupIndex[i] !== g) continue;
          if (selected && selected[i] !== layer) continue;
          const ix = Math.round(sx[i] - plot.left);
          const iy = Math.round(sy[i] - plot.top);
          if (ix >= 0 && iy >= 0 && ix < plot.width && iy < plot.height) {
            const idx = iy * plot.width + ix;
            if (drawn[idx] === MAX_PER_CELL) continue;
            drawn[idx]++;
          } else if (
            ix < -reach ||
            iy < -reach ||
            ix >= plot.width + reach ||
            iy >= plot.height + reach
          ) {
            continue;
          }
          if (plain) {
            ctx.beginPath();
            ctx.arc(sx[i], sy[i], radius, 0, Math.PI * 2);
            ctx.fill();
            if (borderWidth) ctx.stroke();
          } else {
            drawPoint(
              ctx,
              shape.type,
              sx[i],
              sy[i],
              radius,
              shape.style,
              borderWidth,
              color,
              surface,
            );
          }
          if (i % CHUNK === 0)
            progress("render", (l * passes.length + g + i / n) / steps);
        }
      });
    });
  }
  ctx.globalAlpha = 1;

  // ── focus: 조건에 맞는 점을 맨 위에 ────────────────────────────
  if (focused && focusedCount > 0) {
    const f = o.focus;
    const r = Math.max(0.5, f.size / 2);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = Math.max(1, shape.borderWidth || 1);
    let batched = 0;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (!focused[i]) continue;
      if (selected && !selected[i]) continue;
      pathPoint(ctx, f.shape, sx[i], sy[i], r);
      if (++batched === 10_000) {
        finishBatch(ctx, { ...shape, type: f.shape }, f.color, surface);
        ctx.beginPath();
        batched = 0;
      }
    }
    if (batched > 0)
      finishBatch(ctx, { ...shape, type: f.shape }, f.color, surface);
  }

  // ── 예측 선과 구간 ────────────────────────────────────────────
  if (predicted.length > 0) {
    drawForecasts(ctx, predicted, x, y, lineWidthOf(o, 1.5));
  }

  // ── 점 글자 (픽셀로 줄인 점이 적을 때만) ─────────────────────────
  if (!input.compact && o.pointLabel.visible && px.length <= MAX_LABEL_POINTS) {
    const guard = createLabelGuard();
    const font = fontPx(o, 10, o.pointLabel.fontSize);
    for (let k = 0; k < px.length; k++) {
      drawPointLabel(ctx, px[k], py[k], keptY[k], o.pointLabel, font, guard);
    }
  }

  if (selection) {
    drawSelection(
      ctx,
      selection,
      (v) => x(v),
      (v) => y(v),
      THEME.selection,
    );
  }
  // 도형은 점 위에, 같은 그림 영역 clip 안에 그린다.
  drawShapes(
    ctx,
    input.shapes,
    (v) => x(v),
    (v) => y(v),
  );
  ctx.restore();

  if (!input.compact) {
    if (scores) drawScoreBox(ctx, plot, scores, o);
    if (o.prediction.description && predicted.length > 0) {
      ctx.save();
      ctx.font = `${fontPx(o, 10)}px ${THEME.font}`;
      ctx.fillStyle = THEME.textMuted;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const text = [
        ...new Set(predicted.map((f) => f.result.description)),
      ].join(" · ");
      ctx.fillText(
        text,
        plot.left + 6,
        plot.top + plot.height - 4,
        plot.width - 12,
      );
      ctx.restore();
    }
  }
  progress("render", 1);

  return {
    chartType: input.chartType ?? "scatter",
    plot,
    x: {
      kind: input.xKind,
      domain: [+x.domain()[0], +x.domain()[1]],
      ...(xLog ? { log: true } : {}),
    },
    y: {
      kind: "number",
      domain: [+y.domain()[0], +y.domain()[1]],
      ...(yAxis.log ? { log: true } : {}),
    },
    points: {
      px,
      py,
      x: keptX,
      y: keptY,
      id: keptId,
      ...(input.legend ? { g: keptG } : {}),
    },
    total: n,
    ...(selection ? { selected: selectedCount } : {}),
    legend: legendMeta,
    ...(scores ? { scores } : {}),
  };
}

/** 모아 둔 path를 shape.style대로 칠한다. cross는 선으로만 보인다. */
function finishBatch(
  ctx: Ctx,
  shape: ChartOptions["shape"],
  color: string,
  stroke: string,
) {
  if (shape.type === "cross" || shape.style === "border") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, shape.borderWidth);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = color;
  ctx.fill();
  if (shape.style === "both" && shape.borderWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = shape.borderWidth;
    ctx.stroke();
  }
}
