// radar 렌더러. x 범주가 축(12시부터 시계 방향), legend 값이 계열(다각형)이다. legend가 없으면 한 계열이다.
// 눈금은 동심 다각형으로 그리고, 축은 모든 계열이 같은 값 범위(0 또는 최솟값 → 최댓값)를 쓴다.
// 이동·확대가 없어 고정 좌표 공간(polar.ts)을 쓰고, 선택은 꼭짓점으로 판정한다.

import { scaleLinear } from "d3-scale";
import { RADAR_MIN_AXES } from "../data/polar-data";
import { AGG_LABELS, type AggFn } from "../data/schema";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { type ChartOptions, optionsOf } from "./options";
import { drawEmpty, drawHeader, fixedSpace } from "./polar";
import { drawSelection, type Region, regionTester } from "./region";
import { type AxisMeta, compactPlot, type ProgressFn } from "./scatter";
import {
  alphaOf,
  drawPanel,
  drawPoint,
  fontPx,
  lineWidthOf,
  pointSizeOf,
  surfaceOf,
} from "./style";
import { THEME } from "./theme";

export type RadarSeries = {
  name: string;
  color: string;
  /** legend 인덱스 (legend가 없으면 0) */
  index: number;
  /** 축 순서대로의 값 */
  values: (number | null)[];
  /** 꼭짓점의 PNG 좌표. 값이 없는 축은 null */
  points: ([number, number] | null)[];
};

export type RadarMeta = {
  chartType: "radar";
  plot: { left: number; top: number; width: number; height: number };
  /** 고정 좌표 공간: 그림 영역 픽셀과 1:1 */
  x: AxisMeta;
  y: AxisMeta;
  center: { x: number; y: number };
  radius: number;
  /** x 컬럼 라벨 (툴팁 줄 이름) */
  axisTitle: string;
  axes: string[];
  /** 중심 → 바깥 값 범위 */
  domain: [number, number];
  /** 보이는 계열만 */
  series: RadarSeries[];
  agg?: AggFn;
  /** 선택 영역 안의 꼭짓점 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type RadarInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  axisTitle: string;
  axes: string[];
  /** [축][계열] */
  cells: (number | null)[][];
  agg?: AggFn;
  /** legend가 없을 때의 색과 계열 이름 */
  color: string;
  seriesName: string;
  legend?: LegendInput;
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const START = -Math.PI / 2;
const LABEL_GAP = 8;
const LABEL_MAX_WIDTH = 72;
const DOT_R = 3;
const LINE_WIDTH = 2;
const FILL_ALPHA = 0.12;
/** 꼭짓점 테두리(배경색) 굵기 */
const DOT_BORDER = 1.5;

/** 빈 칸(그 축·계열에 값이 없음)을 value.nullNumeric으로 채운다. null이면 그대로 둔다. */
export function fillEmptyCells(
  cells: readonly (number | null)[][],
  seriesCount: number,
  nullNumeric: number | null,
): (number | null)[][] {
  if (nullNumeric === null) return cells as (number | null)[][];
  return cells.map((row) =>
    Array.from({ length: seriesCount }, (_, g) => row[g] ?? nullNumeric),
  );
}

/** 축 i의 각도. 12시에서 시계 방향으로 똑같이 나눈다. */
export function axisAngle(i: number, n: number) {
  return START + (Math.PI * 2 * i) / n;
}

/** 값 범위: 0을 포함하고(음수가 있으면 최솟값부터) 보기 좋게 끝을 맞춘다. */
export function radarDomain(cells: readonly (number | null)[][]) {
  let lo = 0;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of cells) {
    for (const v of row) {
      if (v === null || !Number.isFinite(v)) continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (!Number.isFinite(hi) || hi <= lo) hi = lo + 1;
  const scale = scaleLinear().domain([lo, hi]).nice(4);
  return scale;
}

/** 꼭짓점 PNG 좌표 */
export function vertexOf(
  center: { x: number; y: number },
  r: number,
  i: number,
  n: number,
): [number, number] {
  const a = axisAngle(i, n);
  return [center.x + Math.cos(a) * r, center.y + Math.sin(a) * r];
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

export function renderRadar(
  ctx: Ctx,
  input: RadarInput,
  progress: ProgressFn,
): RadarMeta {
  const { width, height, axes, legend } = input;
  const o = optionsOf(input);
  const n = axes.length;
  const seriesCount = legend?.values.length ?? 1;
  const cells = fillEmptyCells(input.cells, seriesCount, o.value.nullNumeric);
  const off = hiddenIndexes(legend);
  const scale = radarDomain(cells);
  const [d0, d1] = scale.domain();
  progress("aggregate", 1);

  drawPanel(ctx, width, height, o);
  const axisFont = fontPx(o, 11);
  ctx.font = `${axisFont}px ${THEME.font}`;
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, 0, legend, o);
  const space = fixedSpace(plot);
  const center = {
    x: plot.left + plot.width / 2,
    y: plot.top + plot.height / 2,
  };
  const labelWidth = Math.min(
    LABEL_MAX_WIDTH,
    Math.max(0, ...axes.map((a) => ctx.measureText(a).width)),
  );
  const radius = Math.max(
    4,
    input.compact
      ? Math.min(plot.width, plot.height) / 2 - 2
      : Math.min(
          plot.width / 2 - labelWidth - LABEL_GAP - 2,
          plot.height / 2 - LABEL_GAP - axisFont - 3,
        ),
  );
  scale.range([0, radius]);

  const enough = n >= RADAR_MIN_AXES;
  // ── 계열 꼭짓점과 선택 ──────────────────────────────────────────
  const inSelection = input.selection && regionTester(input.selection);
  let selectedCount = 0;
  const series: RadarSeries[] = [];
  const inside: boolean[][] = [];
  for (let g = 0; g < seriesCount; g++) {
    if (off[g]) continue;
    const values = cells.map((row) => row[g] ?? null);
    const points = values.map((v, i) =>
      v === null ? null : vertexOf(center, scale(v), i, n),
    );
    const hits = points.map(
      (p) =>
        enough && !!p && !!inSelection && inSelection(...space.toData(...p)),
    );
    selectedCount += hits.filter(Boolean).length;
    inside.push(hits);
    series.push({
      name: legend?.values[g] ?? input.seriesName,
      color: legend?.colors[g] ?? input.color,
      index: g,
      values,
      points,
    });
  }

  // ── 눈금 (동심 다각형)과 축 ─────────────────────────────────────
  const ticks = scale.ticks(4).filter((t) => t > d0);
  if (enough) {
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    for (const t of ticks) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [px, py] = vertexOf(center, scale(t), i, n);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.strokeStyle = THEME.axis;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [px, py] = vertexOf(center, radius, i, n);
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // ── 계열 다각형 (render) ───────────────────────────────────────
  if (enough) {
    // shape: brush는 다각형 채우기만, border는 선만, both는 둘 다. 투명도는 채우기 진하기다.
    const { shape } = o;
    const fillAlpha = alphaOf(shape.transparency, FILL_ALPHA);
    const lineWidth = lineWidthOf(o, LINE_WIDTH);
    const dot = pointSizeOf(o, DOT_R);
    const surface = surfaceOf(o);
    for (const [k, s] of series.entries()) {
      const any = !inSelection || inside[k].some(Boolean);
      const alpha = any ? 1 : 0.2;
      const shown = s.points.filter((p): p is [number, number] => p !== null);
      if (shown.length === 0) continue;
      ctx.beginPath();
      shown.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      if (shape.style !== "border") {
        ctx.globalAlpha = fillAlpha * alpha;
        ctx.fillStyle = s.color;
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      if (shape.style !== "brush") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      if (!input.compact) {
        s.points.forEach((p, i) => {
          if (!p) return;
          ctx.globalAlpha = !inSelection || inside[k][i] ? 1 : 0.2;
          // 꼭짓점: 모양·크기, 테두리는 배경색 (borderWidth를 정하면 그 굵기)
          drawPoint(
            ctx,
            shape.type,
            p[0],
            p[1],
            dot,
            shape.style,
            shape.borderWidth || DOT_BORDER,
            s.color,
            surface,
          );
        });
      }
      ctx.globalAlpha = 1;
    }
  }
  progress("render", 0.8);

  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    if (enough) {
      // ── 축 라벨과 눈금 값 ───────────────────────────────────────
      ctx.font = `${axisFont}px ${THEME.font}`;
      ctx.fillStyle = THEME.textSecondary;
      for (let i = 0; i < n; i++) {
        const a = axisAngle(i, n);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        ctx.textAlign = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
        ctx.textBaseline = sin > 0.3 ? "top" : sin < -0.3 ? "bottom" : "middle";
        ctx.fillText(
          truncate(ctx, axes[i], LABEL_MAX_WIDTH),
          center.x + cos * (radius + LABEL_GAP),
          center.y + sin * (radius + LABEL_GAP),
        );
      }
      const format = scale.tickFormat(4);
      ctx.fillStyle = THEME.textMuted;
      ctx.font = `${fontPx(o, 10)}px ${THEME.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const t of ticks) {
        ctx.fillText(format(t), center.x + 4, center.y - scale(t));
      }
    } else {
      drawEmpty(
        ctx,
        plot,
        `축(${input.axisTitle})이 ${RADAR_MIN_AXES}개 이상이어야 합니다`,
        o,
      );
    }
    drawHeader(
      ctx,
      plot,
      input.title,
      [
        input.agg ? AGG_LABELS[input.agg] : "",
        `${n}개 축`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );
    legendMeta = legend ? drawLegendAround(ctx, legend, plot, 0, o) : undefined;
  }

  if (input.selection) {
    drawSelection(ctx, input.selection, space.px, space.py, THEME.selection);
  }
  progress("render", 1);

  return {
    chartType: "radar",
    plot,
    x: space.x,
    y: space.y,
    center,
    radius,
    axisTitle: input.axisTitle,
    axes,
    domain: [d0, d1],
    series: enough ? series : [],
    agg: input.agg,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
