// candle 렌더러. x는 시계열(epoch ms) 선형 축, y는 숫자 축이다.
// 구간마다 심지(고가~저가)와 몸통(시가~종가)을 그리고, 상승(종가 ≥ 시가)과 하락을 색으로 가른다.
// legend는 데이터 컬럼이 아니라 '상승/하락' 두 항목이라 체크박스로 한쪽을 숨길 수 있다.

import { scaleLinear, scaleUtc } from "d3-scale";
import { focusTest } from "./analytics/focus";
import {
  drawAxisTitles,
  drawXAxis,
  drawYAxis,
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
import { type ChartOptions, optionsOf } from "./options";
import { drawSelection, type Region, regionTester } from "./region";
import {
  type AxisMeta,
  compactPlot,
  type ItemView,
  type ProgressFn,
} from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import {
  createLabelGuard,
  drawPanel,
  drawPointLabel,
  fontPx,
  lineWidthOf,
} from "./style";
import { PALETTE, THEME } from "./theme";

/** candle의 고정 legend. 색은 국내 시세 관례(상승 빨강, 하락 파랑)를 따른다. */
export const CANDLE_LEGEND = {
  title: "캔들",
  values: ["상승", "하락"],
  colors: [PALETTE[7].hex, PALETTE[0].hex],
} as const;

const RISING = 0;
const FALLING = 1;

export type CandleSeries = {
  t: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  count: number[];
};

export type CandleMeta = {
  chartType: "candle";
  plot: { left: number; top: number; width: number; height: number };
  x: AxisMeta;
  y: AxisMeta;
  /** 구간 길이(ms) */
  interval: number;
  /** 몸통 픽셀 너비 */
  bodyWidth: number;
  /** 그린 캔들 (숨긴 legend 값은 빠진다). g는 legend 인덱스 (상승 0, 하락 1, 새 범례는 그 뒤) */
  candles: CandleSeries & { g: number[] };
  /** 선택 영역 안에 든 캔들 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type CandleInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  interval: number;
  candles: CandleSeries;
  /** 상승/하락 두 항목 + 새 범례 항목 */
  legend: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 새 범례 영역. 대표점(구간 가운데, 종가)이 영역 안인 캔들은 legend 끝에 덧붙인 항목 색으로 칠한다. */
  groups?: readonly Region[];
  /** 선택 영역. 바깥 캔들은 흐리게 그린다. */
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const BODY_RATIO = 0.7;

/**
 * 시계열 x축 (candle·gantt). 위치는 숫자(epoch ms) 선형 축으로 계산하고 눈금 자리만 scaleUtc에서 받는다.
 * 범위 폭 90px마다 눈금 하나. 1ms보다 좁으면 눈금이 없을 수 있어 가운데 하나를 둔다.
 */
export function timeXAxis(domain: [number, number], range: [number, number]) {
  const scale = scaleLinear().domain(domain).range(range);
  const count = Math.max(2, Math.floor((range[1] - range[0]) / 90));
  const ticks = scaleUtc()
    .domain(domain)
    .ticks(count)
    .map(Number)
    .filter((t) => t >= domain[0] && t <= domain[1]);
  return {
    scale,
    ticks: ticks.length > 0 ? ticks : [(domain[0] + domain[1]) / 2],
  };
}

/** 캔들 i를 대표하는 데이터 좌표: 구간 가운데 시각과 종가. 선택·새 범례 판정에 쓴다. */
export function candlePoint(
  candles: CandleSeries,
  interval: number,
  i: number,
): [number, number] {
  return [candles.t[i] + interval / 2, candles.close[i]];
}

/** 확대하지 않았을 때의 범위: 첫 구간 시작 ~ 마지막 구간 끝, 저가 최소 ~ 고가 최대 */
export function candleExtent(
  candles: CandleSeries,
  interval: number,
): ItemView {
  const n = candles.t.length;
  if (n === 0) {
    const now = 0;
    return { x: [now, now + interval], y: [0, 1] };
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, candles.low[i]);
    hi = Math.max(hi, candles.high[i]);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return { x: [candles.t[0], candles.t[n - 1] + interval], y: [lo, hi] };
}

/** 구간 길이를 '5분', '1시간'처럼 */
export function intervalLabel(ms: number) {
  const units: [number, string][] = [
    [86_400_000, "일"],
    [3_600_000, "시간"],
    [60_000, "분"],
    [1000, "초"],
  ];
  for (const [size, name] of units) {
    if (ms >= size && ms % size === 0) return `${ms / size}${name}`;
  }
  return `${ms}ms`;
}

/**
 * focus 조건에 맞는 캔들. target x는 구간 가운데 시각, y는 종가로 견준다.
 * focus가 꺼져 있으면 undefined
 */
export function candleFocus(
  candles: CandleSeries,
  interval: number,
  o: ChartOptions,
): Uint8Array | undefined {
  if (!o.focus.enabled) return undefined;
  const test = focusTest(o.focus);
  const out = new Uint8Array(candles.t.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = test(...candlePoint(candles, interval, i)) ? 1 : 0;
  }
  return out;
}

export function renderCandle(
  ctx: Ctx,
  input: CandleInput,
  progress: ProgressFn,
): CandleMeta {
  const o = optionsOf(input);
  const { width, height, candles, interval, view } = input;
  const n = candles.t.length;
  const full = candleExtent(candles, interval);
  const groups = (input.groups ?? []).map(regionTester);
  const groupBase = input.legend.values.length - groups.length;
  const off = hiddenIndexes(input.legend);
  const inSelection = input.selection && regionTester(input.selection);

  // 캔들마다 legend 인덱스: 상승/하락, 새 범례 영역 안이면 덧붙인 항목
  const index = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const point = candlePoint(candles, interval, i);
    index[i] = candles.close[i] >= candles.open[i] ? RISING : FALLING;
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](point[0], point[1])) {
        index[i] = groupBase + k;
        break;
      }
    }
  }

  const focus = candleFocus(candles, interval, o);

  drawPanel(ctx, width, height, o);

  // ── 축 (aggregate) ────────────────────────────────────────────
  // 값 축은 min·max·log·소수 자리를 따르고, 확대 중이면 확대 범위가 이긴다.
  // 눈금은 범위(px)와 상관없으므로 글자 폭을 먼저 재고, 그림 영역이 정해지면 같은 축을 다시 만든다.
  const yAxisOf = (range: [number, number]) =>
    valueScale(view?.y ?? full.y, range, o.axes.y, {
      nice: !view,
      zoomed: view !== undefined,
    });
  const { ticks: yTicks, format: yFormat } = yAxisOf([1, 0]);
  const yLabelWidth = labelWidth(
    ctx,
    yTicks.map((t) => yFormat(t)),
    fontPx(o, 11, o.axes.y.label.fontSize),
  );
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend, o);
  const { scale: y, log: yLog } = yAxisOf([plot.top + plot.height, plot.top]);
  const xDomain = view?.x ?? full.x;
  const { scale: x, ticks: xTicks } = timeXAxis(
    [xDomain[0], xDomain[1]],
    [plot.left, plot.left + plot.width],
  );
  const xFormat = timeFormat(o.axes.x.dateFormat, [xDomain[0], xDomain[1]]);
  const slot = (plot.width * interval) / (xDomain[1] - xDomain[0]);
  const bodyWidth = Math.max(1, slot * BODY_RATIO);
  progress("aggregate", 1);

  // 그릴 캔들과 선택 수. 숨긴 값은 그리지도, 세지도 않는다.
  const kept: CandleMeta["candles"] = {
    t: [],
    open: [],
    high: [],
    low: [],
    close: [],
    count: [],
    g: [],
  };
  const inside = new Uint8Array(n);
  let selectedCount = 0;
  for (let i = 0; i < n; i++) {
    if (off[index[i]]) continue;
    const point = candlePoint(candles, interval, i);
    inside[i] = !inSelection || inSelection(...point) ? 1 : 0;
    if (inSelection && inside[i]) selectedCount++;
    kept.t.push(candles.t[i]);
    kept.open.push(candles.open[i]);
    kept.high.push(candles.high[i]);
    kept.low.push(candles.low[i]);
    kept.close.push(candles.close[i]);
    kept.count.push(candles.count[i]);
    kept.g.push(index[i]);
  }

  // ── 그리드와 축, 제목, legend ───────────────────────────────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawYAxis(ctx, plot, y, yTicks, yFormat, o);
    drawXAxis(ctx, plot, x, xTicks, xFormat, o);
    drawAxisTitles(ctx, plot, o, { x: "시간", y: "값" }, yLabelWidth);
    drawTitle(
      ctx,
      plot,
      input.title,
      [
        `${intervalLabel(interval)} 간격`,
        `${n.toLocaleString()}개 구간`,
        inSelection ? `${selectedCount.toLocaleString()}개 선택` : "",
      ],
      o,
    );
    legendMeta = drawLegendAround(ctx, input.legend, plot, yLabelWidth, o);
  }

  // ── 캔들 (render) ─────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  if (n === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  }
  const [x0, x1] = xDomain;
  const wick = lineWidthOf(o, 1);
  // focus: 조건에 맞는 캔들은 focus 색, legendSingleColor면 나머지는 회색 한 가지
  const colorOf = (i: number) =>
    focus?.[i]
      ? o.focus.color
      : focus && o.focus.legendSingleColor
        ? o.palette.othersColor
        : (input.legend.colors[index[i]] ?? THEME.textMuted);
  for (let i = 0; i < n; i++) {
    if (off[index[i]]) continue;
    // 보이는 범위 밖 구간은 건너뛴다.
    if (candles.t[i] + interval < x0 || candles.t[i] > x1) continue;
    const color = colorOf(i);
    const cx = x(candles.t[i] + interval / 2);
    ctx.globalAlpha = inside[i] ? 1 : o.shape.dimOpacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = wick;
    // 심지
    const wickX = Math.round(cx) + 0.5;
    ctx.beginPath();
    ctx.moveTo(wickX, y(candles.high[i]));
    ctx.lineTo(wickX, y(candles.low[i]));
    ctx.stroke();
    // 몸통
    const top = y(Math.max(candles.open[i], candles.close[i]));
    const bottom = y(Math.min(candles.open[i], candles.close[i]));
    ctx.fillRect(cx - bodyWidth / 2, top, bodyWidth, Math.max(1, bottom - top));
    if (i % 50 === 0) progress("render", i / n);
  }
  ctx.globalAlpha = 1;
  // 종가 글자: 몸통 위(아래·가운데), 겹치면 건너뛴다.
  if (o.pointLabel.visible && !input.compact) {
    const guard = createLabelGuard();
    const font = fontPx(o, 10, o.pointLabel.fontSize);
    for (let i = 0; i < n; i++) {
      if (off[index[i]]) continue;
      if (candles.t[i] + interval < x0 || candles.t[i] > x1) continue;
      const anchor =
        o.pointLabel.position === "bottom"
          ? Math.min(candles.open[i], candles.close[i])
          : o.pointLabel.position === "top"
            ? Math.max(candles.open[i], candles.close[i])
            : candles.close[i];
      drawPointLabel(
        ctx,
        x(candles.t[i] + interval / 2),
        y(anchor),
        candles.close[i],
        o.pointLabel,
        font,
        guard,
      );
    }
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
  progress("render", 1);

  return {
    chartType: "candle",
    plot,
    x: { kind: "time", domain: [xDomain[0], xDomain[1]] },
    y: {
      kind: "number",
      domain: [y.domain()[0], y.domain()[1]],
      ...(yLog ? { log: true } : {}),
    },
    interval,
    bodyWidth,
    candles: kept,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
