// pie 렌더러. 조각은 12시 방향에서 시계 방향으로 큰 순서대로 놓는다.
// 조각 범주가 곧 legend라 legend 체크박스로 조각을 끄고, 남은 조각끼리 비율을 다시 낸다.
// 이동·확대가 없어 고정 좌표 공간(polar.ts)을 쓰고, 선택은 조각 중심점으로 판정한다.

import type { PieSliceValue } from "../data/polar-data";
import { AGG_LABELS, type AggFn } from "../data/schema";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { drawEmpty, drawHeader, fixedSpace } from "./polar";
import { drawSelection, type Region, regionTester } from "./region";
import { type AxisMeta, compactPlot, type ProgressFn } from "./scatter";
import { THEME } from "./theme";

export type PieSlice = PieSliceValue & {
  /** 보이는 조각 합계 대비 비율 */
  ratio: number;
  /** 캔버스 각도(라디안). 12시 방향이 -π/2이고 시계 방향으로 커진다. */
  start: number;
  end: number;
  color: string;
  /** legend 인덱스 */
  index: number;
};

export type PieMeta = {
  chartType: "pie";
  plot: { left: number; top: number; width: number; height: number };
  /** 고정 좌표 공간: 그림 영역 픽셀과 1:1 */
  x: AxisMeta;
  y: AxisMeta;
  /** 원의 중심(PNG 좌표)과 반지름(px) */
  center: { x: number; y: number };
  radius: number;
  /** 보이는 조각만, 그린 순서대로 */
  slices: PieSlice[];
  /** 보이는 조각 합계 */
  total: number;
  agg?: AggFn;
  /** 선택 영역 안에 중심점이 든 조각 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type PieInput = {
  width: number;
  height: number;
  title: string;
  /** 큰 순 조각. legend.values와 같은 순서다. */
  slices: PieSliceValue[];
  agg?: AggFn;
  /** 조각 범주와 색. 끈 값(hidden)은 그리지 않는다. */
  legend: LegendInput;
  /** 선택 영역(고정 좌표). 바깥 조각은 흐리게 그린다. */
  selection?: Region;
  /** 섬네일: 제목·legend 없이 원만 그린다. */
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const START = -Math.PI / 2;
/** 원과 그림 영역 사이 여백 */
const PIE_PAD = 6;
/** 조각 사이를 가르는 배경색 선 */
const SEPARATOR = 1.5;
/** 이 비율보다 작은 조각에는 비율 글자를 넣지 않는다. */
const LABEL_MIN_RATIO = 0.05;
/** 중심점(선택 판정)과 비율 글자를 놓는 반지름 비율 */
const CENTROID_RATIO = 0.62;

/** 보이는 조각의 비율과 각도. 끈 조각은 빠지고 남은 조각끼리 원을 나눈다. */
export function layoutPie(
  slices: readonly PieSliceValue[],
  colors: readonly string[],
  hidden: readonly boolean[],
) {
  const visible = slices
    .map((s, index) => ({ ...s, index }))
    .filter((s) => !hidden[s.index]);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  let angle = START;
  const laid: PieSlice[] = visible.map((s) => {
    const ratio = total > 0 ? s.value / total : 0;
    const start = angle;
    angle += ratio * Math.PI * 2;
    return { ...s, ratio, start, end: angle, color: colors[s.index] };
  });
  return { slices: laid, total };
}

/** 조각의 대표점(PNG 좌표): 가운데 각도, 반지름의 CENTROID_RATIO 지점 */
export function sliceCentroid(
  center: { x: number; y: number },
  radius: number,
  slice: Pick<PieSlice, "start" | "end">,
): [number, number] {
  const mid = (slice.start + slice.end) / 2;
  const r = radius * CENTROID_RATIO;
  return [center.x + Math.cos(mid) * r, center.y + Math.sin(mid) * r];
}

/** 배경 위 비율 글자 색: 밝은 조각에는 검은 글자, 어두운 조각에는 흰 글자 */
function labelColor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? THEME.textPrimary : "#fff";
}

export function renderPie(
  ctx: Ctx,
  input: PieInput,
  progress: ProgressFn,
): PieMeta {
  const { width, height, legend } = input;
  const { slices, total } = layoutPie(
    input.slices,
    legend.colors,
    hiddenIndexes(legend),
  );
  progress("aggregate", 1);

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, 0, legend);
  const space = fixedSpace(plot);
  const center = {
    x: plot.left + plot.width / 2,
    y: plot.top + plot.height / 2,
  };
  const radius = Math.max(
    1,
    Math.min(plot.width, plot.height) / 2 - (input.compact ? 0 : PIE_PAD),
  );

  const inSelection = input.selection && regionTester(input.selection);
  const inside = slices.map(
    (s) =>
      !inSelection ||
      inSelection(...space.toData(...sliceCentroid(center, radius, s))),
  );
  const selectedCount = inside.filter(Boolean).length;

  // ── 조각 (render) ─────────────────────────────────────────────
  for (const [i, s] of slices.entries()) {
    ctx.globalAlpha = inside[i] ? 1 : 0.2;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    if (s.ratio >= 1) {
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    } else {
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius, s.start, s.end);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (slices.length > 1) {
    // 조각 경계: 중심에서 바깥으로 배경색 선
    ctx.strokeStyle = THEME.surface;
    ctx.lineWidth = SEPARATOR;
    ctx.beginPath();
    for (const s of slices) {
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + Math.cos(s.start) * radius,
        center.y + Math.sin(s.start) * radius,
      );
    }
    ctx.stroke();
  }
  progress("render", 0.8);

  if (!input.compact) {
    // ── 비율 글자 ─────────────────────────────────────────────
    ctx.font = `600 11px ${THEME.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (radius >= 40) {
      for (const [i, s] of slices.entries()) {
        if (s.ratio < LABEL_MIN_RATIO) continue;
        const [lx, ly] = sliceCentroid(center, radius, s);
        ctx.globalAlpha = inside[i] ? 1 : 0.4;
        ctx.fillStyle = labelColor(s.color);
        ctx.fillText(`${Math.round(s.ratio * 100)}%`, lx, ly);
      }
      ctx.globalAlpha = 1;
    }
    if (slices.length === 0) drawEmpty(ctx, plot, "보이는 조각이 없습니다");

    drawHeader(ctx, plot, input.title, [
      input.agg ? AGG_LABELS[input.agg] : "",
      `${slices.length}개 조각`,
      inSelection ? `${selectedCount}개 선택` : "",
    ]);
  }

  // ── legend ──────────────────────────────────────────────────────
  const legendMeta = input.compact
    ? undefined
    : drawLegendAround(ctx, legend, plot, 0);

  if (input.selection) {
    drawSelection(ctx, input.selection, space.px, space.py, THEME.selection);
  }
  progress("render", 1);

  return {
    chartType: "pie",
    plot,
    x: space.x,
    y: space.y,
    center,
    radius,
    slices,
    total,
    agg: input.agg,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
