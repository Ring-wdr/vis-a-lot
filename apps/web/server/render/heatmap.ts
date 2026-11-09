// heatmap 렌더러. x·y 모두 범주 인덱스(0, 1, 2 …)를 연속 좌표로 쓴다 (category.ts와 같은 방식).
// 그래서 확대(인덱스 범위)·이동·선택·도형이 다른 차트처럼 동작한다. y 인덱스 0은 아래쪽이다.
// 칸 색은 값의 순차 색상 척도(한 색상, 옅음 → 짙음)이고, 그림 오른쪽에 색 막대를 둔다.
// legend 컬럼은 쓰지 않는다. 페인트로 만든 새 범례만 legend 상자에 놓고 그 영역 안 칸을 그 색으로 칠한다.

import { scaleLinear } from "d3-scale";
import { AGG_LABELS, type AggFn } from "../data/schema";
import { drawAxisTitles, timeFormat } from "./axis-style";
import { drawTitle } from "./frame";
import {
  drawLegendAround,
  framePlot,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import {
  type ChartOptions,
  optionsOf,
  type PaletteOptions,
  type ValueOptions,
} from "./options";
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
  gradientColors,
  surfaceOf,
} from "./style";
import { THEME } from "./theme";

export type HeatmapMeta = {
  chartType: "heatmap";
  plot: { left: number; top: number; width: number; height: number };
  /** x 범주 인덱스 공간 */
  x: AxisMeta;
  /** y 범주 인덱스 공간 (0이 아래) */
  y: AxisMeta;
  xTitle: string;
  yTitle: string;
  xCategories: string[];
  /** 시계열 x: 구간 시작 시각(epoch ms)과 구간 길이 */
  xStarts?: number[];
  timeBin?: number;
  yCategories: string[];
  /** [x][y] 집계값 */
  cells: (number | null)[][];
  agg: AggFn;
  /** 색 척도의 값 범위 */
  colorDomain: [number, number];
  /** 선택 영역 안에 든 칸 수. 선택이 없으면 없다. */
  selected?: number;
  /** 페인트로 만든 새 범례 */
  legend?: LegendMeta;
};

export type HeatmapInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  xTitle: string;
  yTitle: string;
  xCategories: string[];
  xStarts?: number[];
  timeBin?: number;
  yCategories: string[];
  cells: (number | null)[][];
  agg: AggFn;
  /** 새 범례 (페인트). values/colors가 groups 순서와 같다. */
  legend?: LegendInput;
  /** 새 범례 영역. 칸 가운데가 영역 안이면 그 항목 색으로 칠한다. 겹치면 나중 영역이 이긴다. */
  groups?: readonly Region[];
  /** 선택 영역. 바깥 칸은 흐리게 그린다. */
  selection?: Region;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 섬네일: 축·제목·색 막대 없이 그림 영역만 그린다. */
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

/**
 * dataviz 기본 순차 색상(파랑) 100 → 700. 가장 옅은 칸이 0에 가까운 값이다.
 * 같은 간격의 단계를 차례로 이어 칠한다.
 */
export const SEQUENTIAL_RAMP = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
] as const;

/** 색 막대 폭과, 막대 + 눈금 글자가 차지하는 오른쪽 공간 */
const BAR_WIDTH = 10;
const BAR_SPACE = 56;
/** y 범주 글자 폭 상한 */
const Y_LABEL_MAX = 90;
/** 칸이 이 픽셀보다 크면 칸 사이에 배경색 간격(1px)을 둔다. */
const GAP_MIN_CELL = 6;

/** 값 범위. 칸이 하나뿐이거나 값이 모두 같으면 양쪽으로 벌린다. */
export function colorDomainOf(
  cells: readonly (number | null)[][],
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const col of cells) {
    for (const v of col) {
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

/**
 * 색 척도의 색 단계. palette.gradient가 켜져 있으면 시작→(중간)→끝(뒤집기 반영) 색을,
 * steps가 있으면 그 수만큼 끊어진 단계(discrete)로 쓴다. 아니면 기본 순차 색(이어 칠하기)이다.
 */
export function rampOf(palette?: PaletteOptions): {
  colors: readonly string[];
  discrete: boolean;
} {
  if (!palette?.gradient) return { colors: SEQUENTIAL_RAMP, discrete: false };
  if (palette.steps > 0)
    return {
      colors: gradientColors(palette, Math.max(2, Math.round(palette.steps))),
      discrete: true,
    };
  const stops = [palette.start, palette.middle, palette.end].filter(Boolean);
  if (palette.reverse) stops.reverse();
  return { colors: stops, discrete: false };
}

/**
 * 값 → 순차 색. domain을 단계 수만큼 고르게 나눠 이어 칠한다.
 * palette를 주면 rampOf의 색으로, 끊어진 단계면 값이 든 단계의 색 하나로 칠한다.
 */
export function sequentialColor(
  domain: [number, number],
  palette?: PaletteOptions,
): (v: number) => string {
  const [d0, d1] = domain;
  const { colors, discrete } = rampOf(palette);
  if (discrete) {
    return (v: number) => {
      const t = (v - d0) / (d1 - d0 || 1);
      const k = Math.floor(t * colors.length);
      return colors[Math.min(colors.length - 1, Math.max(0, k))];
    };
  }
  const stops = colors.map(
    (_, i) => d0 + ((d1 - d0) * i) / (colors.length - 1),
  );
  return scaleLinear<string>()
    .domain(stops)
    .range([...colors])
    .clamp(true);
}

/** value.nullNumeric이 있으면 빈 칸(null)을 그 값으로 채운다. 없으면 그대로 */
export function fillNulls(
  cells: (number | null)[][],
  value: ValueOptions,
): (number | null)[][] {
  const fill = value.nullNumeric;
  if (fill === null) return cells;
  return cells.map((col) => col.map((v) => v ?? fill));
}

/** 범주 축 하나의 글자를 겹치지 않게 건너뛸 간격 */
function labelStep(size: number, band: number) {
  return Math.max(1, Math.ceil(size / Math.max(band, 1)));
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

export function renderHeatmap(
  ctx: Ctx,
  input: HeatmapInput,
  progress: ProgressFn,
): HeatmapMeta {
  const o = optionsOf(input);
  const { width, height, xCategories, yCategories, view } = input;
  // 빈 칸을 값으로 채우면 metadata(툴팁)도 채운 값을 본다.
  const cells = fillNulls(input.cells, o.value);
  const nx = xCategories.length;
  const ny = yCategories.length;
  const groups = (input.groups ?? []).map(regionTester);
  const inSelection = input.selection && regionTester(input.selection);
  const colorDomain = colorDomainOf(cells);
  const color = sequentialColor(colorDomain, o.palette);

  /** 칸 색: 새 범례 영역 안이면 그 항목 색, 아니면 값의 순차 색 */
  const fillOf = (i: number, j: number, v: number) => {
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](i, j)) return input.legend?.colors[k] ?? color(v);
    }
    return color(v);
  };
  let selectedCount = 0;
  if (inSelection) {
    cells.forEach((col, i) => {
      col.forEach((v, j) => {
        if (v !== null && inSelection(i, j)) selectedCount++;
      });
    });
  }

  drawPanel(ctx, width, height, o);

  // ── 축 (aggregate) ────────────────────────────────────────────
  const xAxisO = o.axes.x;
  const yAxisO = o.axes.y;
  const xFont = fontPx(o, 11, xAxisO.label.fontSize);
  const yFont = fontPx(o, 11, yAxisO.label.fontSize);
  // 시계열 x는 dateFormat을 정하면 구간 시작 시각을 그 형식으로 다시 적는다.
  const xLabels =
    input.xStarts && xAxisO.dateFormat.trim()
      ? (() => {
          const starts = input.xStarts;
          const fmt = timeFormat(xAxisO.dateFormat, [
            starts[0] ?? 0,
            starts[starts.length - 1] ?? 0,
          ]);
          return xCategories.map((c, i) =>
            starts[i] === undefined ? c : fmt(starts[i]),
          );
        })()
      : xCategories;
  ctx.font = `${yFont}px ${THEME.font}`;
  const yLabelWidth = Math.min(
    Y_LABEL_MAX,
    Math.max(10, ...yCategories.map((c) => ctx.measureText(c).width)),
  );
  ctx.font = `${xFont}px ${THEME.font}`;
  const xLabelWidth = Math.min(
    80,
    Math.max(10, ...xLabels.map((c) => ctx.measureText(c).width)),
  );
  let plot = input.compact
    ? compactPlot(width, height)
    : framePlot(
        ctx,
        width,
        height,
        yLabelWidth,
        input.legend,
        o,
        xAxisO.label.angle ? xLabelWidth : undefined,
      );
  // legend 상자는 색 막대까지 포함한 폭을 기준으로 놓는다.
  const legendFrame = plot;
  if (!input.compact) {
    plot = { ...plot, width: Math.max(10, plot.width - BAR_SPACE) };
  }
  const xDomain: [number, number] = view?.x ?? [
    -0.5,
    Math.max(0, nx - 1) + 0.5,
  ];
  const yDomain: [number, number] = view?.y ?? [
    -0.5,
    Math.max(0, ny - 1) + 0.5,
  ];
  const x = scaleLinear()
    .domain(xDomain)
    .range([plot.left, plot.left + plot.width]);
  const y = scaleLinear()
    .domain(yDomain)
    .range([plot.top + plot.height, plot.top]);
  const bandX = plot.width / (xDomain[1] - xDomain[0]);
  const bandY = plot.height / (yDomain[1] - yDomain[0]);
  progress("aggregate", 1);

  // ── 축 글자, 제목, 색 막대, legend (섬네일은 그림 영역만 그린다) ────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    // 칸이 그림 영역을 덮으므로 그리드·축 선은 그리지 않는다. 눈금 선(tick.length)과 글자만 축 속성을 따른다.
    const yTick =
      yAxisO.visible && yAxisO.tick.visible
        ? Math.round(yAxisO.tick.length)
        : 0;
    const xTick =
      xAxisO.visible && xAxisO.tick.visible
        ? Math.round(xAxisO.tick.length)
        : 0;
    const yFirst = Math.max(0, Math.ceil(yDomain[0]));
    const yLast = Math.min(ny - 1, Math.floor(yDomain[1]));
    const yStep = labelStep(yFont + 3, bandY);
    const xFirst = Math.max(0, Math.ceil(xDomain[0]));
    const xLast = Math.min(nx - 1, Math.floor(xDomain[1]));
    if (yTick > 0 || xTick > 0) {
      ctx.strokeStyle = yAxisO.tick.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = yFirst; yTick > 0 && j <= yLast; j += yStep) {
        const ty = Math.round(y(j)) + 0.5;
        ctx.moveTo(plot.left - yTick, ty);
        ctx.lineTo(plot.left, ty);
      }
      ctx.stroke();
      ctx.strokeStyle = xAxisO.tick.color;
      ctx.beginPath();
      for (let i = xFirst; xTick > 0 && i <= xLast; i++) {
        const tx = Math.round(x(i)) + 0.5;
        ctx.moveTo(tx, plot.top + plot.height);
        ctx.lineTo(tx, plot.top + plot.height + xTick);
      }
      ctx.stroke();
    }
    // y 범주: 보이는 범주만, 겹치면 건너뛴다.
    if (yAxisO.visible && yAxisO.label.visible) {
      ctx.font = `${yFont}px ${THEME.font}`;
      ctx.fillStyle = yAxisO.label.color;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let j = yFirst; j <= yLast; j += yStep) {
        ctx.fillText(
          truncate(ctx, yCategories[j], yLabelWidth),
          plot.left - 6 - yTick,
          y(j),
        );
      }
    }
    // x 범주
    if (xAxisO.visible && xAxisO.label.visible) {
      ctx.font = `${xFont}px ${THEME.font}`;
      ctx.fillStyle = xAxisO.label.color;
      const top = plot.top + plot.height + 7 + xTick;
      if (xAxisO.label.angle) {
        const xStep = labelStep(xFont + 2, bandX);
        const rad = (-xAxisO.label.angle * Math.PI) / 180;
        ctx.textAlign = xAxisO.label.angle > 0 ? "right" : "left";
        ctx.textBaseline = "middle";
        for (let i = xFirst; i <= xLast; i += xStep) {
          ctx.save();
          ctx.translate(x(i), top);
          ctx.rotate(rad);
          ctx.fillText(truncate(ctx, xLabels[i], 80), 0, 0);
          ctx.restore();
        }
      } else {
        const widest = Math.max(
          1,
          ...xLabels
            .slice(xFirst, xLast + 1)
            .map((c) => ctx.measureText(c).width),
        );
        const xStep = labelStep(Math.min(widest, 80) + 8, bandX);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let i = xFirst; i <= xLast; i += xStep) {
          ctx.fillText(truncate(ctx, xLabels[i], bandX * xStep - 4), x(i), top);
        }
      }
    }
    drawAxisTitles(
      ctx,
      plot,
      o,
      { x: input.xTitle, y: input.yTitle },
      yLabelWidth,
      xAxisO.label.angle ? xLabelWidth : undefined,
    );

    // ── 제목 ──────────────────────────────────────────────────────
    // 요약 글자는 색 막대까지 포함한 폭의 오른쪽 끝에 둔다.
    drawTitle(
      ctx,
      legendFrame,
      input.title,
      [
        AGG_LABELS[input.agg],
        `${nx} × ${ny} 칸`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );

    drawColorBar(
      ctx,
      colorDomain,
      {
        left: plot.left + plot.width + 12,
        top: plot.top,
        height: plot.height,
      },
      o,
    );

    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, legendFrame, yLabelWidth, o)
      : undefined;
  }

  // ── 칸 (render) ────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  if (nx === 0 || ny === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  }
  const gapX = bandX >= GAP_MIN_CELL ? 1 : 0;
  const gapY = bandY >= GAP_MIN_CELL ? 1 : 0;
  // 보이는 칸만 그린다.
  const iFrom = Math.max(0, Math.floor(xDomain[0] + 0.5));
  const iTo = Math.min(nx - 1, Math.ceil(xDomain[1] - 0.5));
  const jFrom = Math.max(0, Math.floor(yDomain[0] + 0.5));
  const jTo = Math.min(ny - 1, Math.ceil(yDomain[1] - 0.5));
  for (let i = iFrom; i <= iTo; i++) {
    const left = x(i - 0.5);
    const w = Math.max(1, bandX - gapX);
    for (let j = jFrom; j <= jTo; j++) {
      const v = cells[i]?.[j];
      if (v === null || v === undefined) continue;
      ctx.fillStyle = fillOf(i, j, v);
      ctx.globalAlpha =
        !inSelection || inSelection(i, j) ? 1 : o.shape.dimOpacity;
      ctx.fillRect(left, y(j + 0.5), w, Math.max(1, bandY - gapY));
    }
    if (i % 50 === 0) progress("render", (i - iFrom) / (iTo - iFrom + 1));
  }
  ctx.globalAlpha = 1;
  // 칸 값 글자: 칸 가운데 기준, 겹치면 건너뛴다.
  if (o.pointLabel.visible && !input.compact) {
    const guard = createLabelGuard();
    const font = fontPx(o, 10, o.pointLabel.fontSize);
    for (let i = iFrom; i <= iTo; i++) {
      for (let j = jFrom; j <= jTo; j++) {
        const v = cells[i]?.[j];
        if (v === null || v === undefined) continue;
        drawPointLabel(ctx, x(i), y(j), v, o.pointLabel, font, guard);
      }
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
    chartType: "heatmap",
    plot,
    x: { kind: "number", domain: xDomain },
    y: { kind: "number", domain: yDomain },
    xTitle: input.xTitle,
    yTitle: input.yTitle,
    xCategories,
    ...(input.xStarts ? { xStarts: input.xStarts } : {}),
    ...(input.timeBin !== undefined ? { timeBin: input.timeBin } : {}),
    yCategories,
    cells,
    agg: input.agg,
    colorDomain,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}

/** 그림 오른쪽의 세로 색 막대. 위가 큰 값이다. 끊어진 단계(palette.steps)면 단계마다 한 색 칸이다. */
function drawColorBar(
  ctx: Ctx,
  domain: [number, number],
  { left, top, height }: { left: number; top: number; height: number },
  o: ChartOptions,
) {
  const { colors, discrete } = rampOf(o.palette);
  if (discrete) {
    const step = height / colors.length;
    colors.forEach((c, k) => {
      ctx.fillStyle = c;
      // 아래가 첫 단계(작은 값)
      ctx.fillRect(left, top + height - step * (k + 1), BAR_WIDTH, step);
    });
  } else {
    const gradient = ctx.createLinearGradient(0, top + height, 0, top);
    colors.forEach((c, i) => {
      gradient.addColorStop(i / (colors.length - 1), c);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(left, top, BAR_WIDTH, height);
  }
  const scale = scaleLinear()
    .domain(domain)
    .range([top + height, top]);
  const ticks = scale.ticks(Math.max(2, Math.min(5, Math.floor(height / 40))));
  const format = scale.tickFormat(5);
  ctx.strokeStyle = surfaceOf(o);
  ctx.lineWidth = 1;
  ctx.fillStyle = THEME.textSecondary;
  ctx.font = `${fontPx(o, 11)}px ${THEME.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const t of ticks) {
    const ty = Math.round(scale(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, ty);
    ctx.lineTo(left + BAR_WIDTH, ty);
    ctx.stroke();
    ctx.fillText(
      format(t),
      left + BAR_WIDTH + 4,
      ty,
      BAR_SPACE - BAR_WIDTH - 16,
    );
  }
}
