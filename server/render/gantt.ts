// gantt 렌더러. x는 시계열(epoch ms) 선형 축, y는 작업 행 인덱스 공간이다.
// 행 i는 y = (행 수 - 1 - i)에 놓여 첫 행이 맨 위에 온다. 행이 많으면 확대·이동으로 일부 행만 본다.
// 막대가 많아도 행마다 같은 픽셀 칸에 들어가는 짧은 구간은 앞 막대에 합쳐 그리기와 metadata를 줄인다.

import { scaleLinear } from "d3-scale";
import type { GanttBars } from "../data/gantt-data";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
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

export type GanttMeta = {
  chartType: "gantt";
  plot: { left: number; top: number; width: number; height: number };
  /** 시계열(epoch ms) */
  x: AxisMeta;
  /** 행 인덱스 공간. 행 i의 가운데는 rows.length - 1 - i */
  y: AxisMeta;
  /** y 컬럼 이름(라벨) */
  rowTitle: string;
  rows: string[];
  /** 막대 픽셀 높이 */
  barHeight: number;
  /**
   * 그린 막대 (숨긴 legend 값·보이지 않는 막대는 빠진다). 같은 픽셀 칸에 합친 짧은 구간은
   * 앞 막대의 e를 늘리고 n에 행 수를, m에 합친 막대 수를 더한다. 행 → 시작 순이다.
   */
  bars: GanttBars & { m: number[] };
  /** 막대가 상한을 넘어 metadata에서 뺀 게 있는지 */
  truncated: boolean;
  /** 선택 영역 안에 든 막대 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type GanttInput = {
  width: number;
  height: number;
  title: string;
  rowTitle: string;
  rows: string[];
  bars: GanttBars;
  color: string;
  legend?: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 새 범례 영역. 막대 가운데가 영역 안이면 legend 끝에 덧붙인 항목 색으로 칠한다. */
  groups?: readonly Region[];
  /** 선택 영역. 막대 가운데가 바깥이면 흐리게 그린다. */
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const BAR_RATIO = 0.7;
/** metadata에 담는 막대 수 상한. 넘으면 그리기만 하고 툴팁에서는 찾지 않는다. */
export const META_BAR_LIMIT = 30_000;
const ROW_LABEL_MAX = 120;
/** 값이 하나뿐일 때 앞뒤로 벌리는 폭 */
const SINGLE_TIME_PAD = 60_000;

/** 행 i의 y 좌표 (첫 행이 맨 위) */
export function rowY(rowCount: number, i: number) {
  return rowCount - 1 - i;
}

/** 막대 j를 대표하는 데이터 좌표: 가운데 시각과 행 y. 선택·새 범례 판정에 쓴다. */
export function barPoint(
  bars: GanttBars,
  rowCount: number,
  j: number,
): [number, number] {
  return [(bars.s[j] + bars.e[j]) / 2, rowY(rowCount, bars.r[j])];
}

/** 확대하지 않았을 때의 범위: 처음 시작 ~ 마지막 끝, 모든 행 */
export function ganttExtent(bars: GanttBars, rowCount: number): ItemView {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let j = 0; j < bars.s.length; j++) {
    lo = Math.min(lo, bars.s[j]);
    hi = Math.max(hi, bars.e[j]);
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = SINGLE_TIME_PAD;
  } else if (lo === hi) {
    lo -= SINGLE_TIME_PAD;
    hi += SINGLE_TIME_PAD;
  }
  return { x: [lo, hi], y: [-0.5, Math.max(0, rowCount - 1) + 0.5] };
}

/**
 * 행마다 픽셀 칸 단위로 막대를 합친다. px0/px1은 막대의 픽셀 범위(그림 영역 기준)이고,
 * 앞 막대가 이미 차지한 칸 안에서 시작하고 끝나는 막대는 앞 막대에 합친다.
 * 돌려주는 값은 막대별로 그릴 막대의 인덱스(자기 자신이면 그린다, 다른 값이면 그 막대에 합쳤다).
 */
export function mergeIntoPixels(
  r: ArrayLike<number>,
  px0: ArrayLike<number>,
  px1: ArrayLike<number>,
  include: (j: number) => boolean,
) {
  const owner = new Int32Array(r.length).fill(-1);
  let row = -1;
  let last = -1;
  let lastCell = Number.NEGATIVE_INFINITY;
  for (let j = 0; j < r.length; j++) {
    if (!include(j)) continue;
    if (r[j] !== row) {
      row = r[j];
      last = -1;
      lastCell = Number.NEGATIVE_INFINITY;
    }
    const startCell = Math.floor(px0[j]);
    const endCell = Math.floor(px1[j]);
    if (last !== -1 && startCell <= lastCell && endCell <= lastCell) {
      owner[j] = last;
      continue;
    }
    owner[j] = j;
    last = j;
    lastCell = Math.max(endCell, startCell);
  }
  return owner;
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

export function renderGantt(
  ctx: Ctx,
  input: GanttInput,
  progress: ProgressFn,
): GanttMeta {
  const { width, height, rows, bars, view } = input;
  const rowCount = rows.length;
  const n = bars.s.length;
  const full = ganttExtent(bars, rowCount);
  const groups = (input.groups ?? []).map(regionTester);
  const groupBase = (input.legend?.values.length ?? 0) - groups.length;
  const off = hiddenIndexes(input.legend);
  const inSelection = input.selection && regionTester(input.selection);

  // 막대마다 legend 인덱스: 원래 값, 새 범례 영역 안이면 덧붙인 항목
  const index = new Uint8Array(n);
  const inside = new Uint8Array(n).fill(1);
  let selectedCount = 0;
  for (let j = 0; j < n; j++) {
    const point = barPoint(bars, rowCount, j);
    index[j] = bars.g[j];
    for (let k = groups.length - 1; k >= 0; k--) {
      if (groups[k](point[0], point[1])) {
        index[j] = groupBase + k;
        break;
      }
    }
    if (off[index[j]]) continue;
    if (inSelection) {
      inside[j] = inSelection(...point) ? 1 : 0;
      if (inside[j]) selectedCount++;
    }
  }
  const colorOf = (i: number) => input.legend?.colors[i] ?? input.color;

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);

  // ── 축 (aggregate) ────────────────────────────────────────────
  const yDomain = view?.y ?? full.y;
  const xDomain = view?.x ?? full.x;
  ctx.font = `11px ${THEME.font}`;
  const labelWidth = Math.min(
    ROW_LABEL_MAX,
    Math.max(10, ...rows.map((r) => ctx.measureText(r).width)),
  );
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, labelWidth, input.legend);
  const y = scaleLinear()
    .domain(yDomain)
    .range([plot.top + plot.height, plot.top]);
  const {
    scale: x,
    ticks: xTicks,
    format: xFormat,
  } = xAxis("time", xDomain, [plot.left, plot.left + plot.width], false);
  const band = plot.height / (yDomain[1] - yDomain[0]);
  const barHeight = Math.max(1, band * BAR_RATIO);

  // 보이는 막대만 픽셀 범위를 구하고, 같은 칸 안의 짧은 구간은 앞 막대에 합친다.
  const px0 = new Float64Array(n);
  const px1 = new Float64Array(n);
  const visible = (j: number) => {
    if (off[index[j]]) return false;
    const ry = rowY(rowCount, bars.r[j]);
    return (
      bars.e[j] >= xDomain[0] &&
      bars.s[j] <= xDomain[1] &&
      ry >= yDomain[0] - 0.5 &&
      ry <= yDomain[1] + 0.5
    );
  };
  for (let j = 0; j < n; j++) {
    px0[j] = Math.max(0, x(bars.s[j]) - plot.left);
    px1[j] = Math.min(plot.width, x(bars.e[j]) - plot.left);
  }
  // 합치는 기준에 색과 흐림까지 넣으면 칸 수가 늘어나므로, 앞 막대의 색을 그대로 쓴다.
  const owner = mergeIntoPixels(bars.r, px0, px1, visible);
  // 그릴 막대의 끝: 합친 막대까지 덮는다.
  const drawEnd = new Float64Array(px1);
  for (let j = 0; j < n; j++) {
    const o = owner[j];
    if (o !== -1 && o !== j) drawEnd[o] = Math.max(drawEnd[o], px1[j]);
  }
  progress("aggregate", 1);

  const kept: GanttMeta["bars"] = { r: [], s: [], e: [], g: [], n: [], m: [] };
  const keptOf = new Int32Array(n).fill(-1);
  let truncated = false;
  for (let j = 0; j < n; j++) {
    const o = owner[j];
    if (o === -1) continue;
    if (o === j) {
      if (kept.r.length >= META_BAR_LIMIT) {
        truncated = true;
        continue;
      }
      keptOf[j] = kept.r.length;
      kept.r.push(bars.r[j]);
      kept.s.push(bars.s[j]);
      kept.e.push(bars.e[j]);
      kept.g.push(index[j]);
      kept.n.push(bars.n[j]);
      kept.m.push(1);
    } else if (keptOf[o] !== -1) {
      const k = keptOf[o];
      kept.e[k] = Math.max(kept.e[k], bars.e[j]);
      kept.n[k] += bars.n[j];
      kept.m[k]++;
    }
  }

  // ── 그리드와 축, 제목, legend ───────────────────────────────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = THEME.textSecondary;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    // 보이는 행만 라벨을 달고, 행이 좁으면 건너뛴다.
    const first = Math.max(0, Math.ceil(rowCount - 1 - yDomain[1]));
    const last = Math.min(rowCount - 1, Math.floor(rowCount - 1 - yDomain[0]));
    const step = Math.max(1, Math.ceil(13 / Math.max(band, 1)));
    for (let i = first; i <= last; i++) {
      const cy = y(rowY(rowCount, i));
      // 행 사이 구분선
      const ty = Math.round(cy + band / 2) + 0.5;
      if (band >= 4 && ty < plot.top + plot.height) {
        ctx.beginPath();
        ctx.moveTo(plot.left, ty);
        ctx.lineTo(plot.left + plot.width, ty);
        ctx.stroke();
      }
      if ((i - first) % step === 0)
        ctx.fillText(truncate(ctx, rows[i], labelWidth), plot.left - 6, cy);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of xTicks) {
      ctx.fillText(
        xFormat(t),
        Math.round(x(t)) + 0.5,
        plot.top + plot.height + 7,
      );
    }
    ctx.strokeStyle = THEME.axis;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top + plot.height + 0.5);
    ctx.lineTo(plot.left + plot.width, plot.top + plot.height + 0.5);
    ctx.stroke();

    ctx.fillStyle = THEME.textPrimary;
    ctx.font = `600 12px ${THEME.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(input.title, plot.left, 17, plot.width);
    ctx.fillStyle = THEME.textMuted;
    ctx.font = `11px ${THEME.font}`;
    ctx.textAlign = "right";
    ctx.fillText(
      [
        `${rowCount.toLocaleString()}개 행`,
        `${n.toLocaleString()}개 구간`,
        inSelection ? `${selectedCount.toLocaleString()}개 선택` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      plot.left + plot.width,
      17,
    );
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, labelWidth)
      : undefined;
  }

  // ── 막대 (render) ─────────────────────────────────────────────
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
  for (let j = 0; j < n; j++) {
    if (owner[j] !== j) continue;
    const cy = y(rowY(rowCount, bars.r[j]));
    ctx.globalAlpha = inside[j] ? 1 : 0.2;
    ctx.fillStyle = colorOf(index[j]);
    // 이웃 막대가 같은 경계를 쓰도록 정수 픽셀에 맞춘다 (반투명 틈이 생기지 않게).
    const left = Math.round(plot.left + px0[j]);
    const right = Math.max(left + 1, Math.round(plot.left + drawEnd[j]));
    ctx.fillRect(left, cy - barHeight / 2, right - left, barHeight);
    if (j % 2000 === 0) progress("render", j / n);
  }
  ctx.globalAlpha = 1;
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
    chartType: "gantt",
    plot,
    x: { kind: "time", domain: [xDomain[0], xDomain[1]] },
    y: { kind: "number", domain: [yDomain[0], yDomain[1]] },
    rowTitle: input.rowTitle,
    rows,
    barHeight,
    bars: kept,
    truncated,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
