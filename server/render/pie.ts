// pie 렌더러. 조각은 12시 방향에서 시계 방향으로 큰 순서대로 놓는다.
// 조각 범주가 곧 legend라 legend 체크박스로 조각을 끄고, 남은 조각끼리 비율을 다시 낸다.
// 이동·확대가 없어 고정 좌표 공간(polar.ts)을 쓰고, 선택은 조각 중심점으로 판정한다.
// 하위 차트: doughnut은 가운데를 비우고, pie3d는 원을 눕혀(타원) 앞쪽 옆면을 그리고,
// sunburst는 안쪽 고리에 조각, 바깥 고리에 조각을 legend 컬럼 값으로 나눈 몫을 그린다.

import type { PieSliceValue } from "../data/polar-data";
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
  borderOf,
  createLabelGuard,
  drawPanel,
  drawPointLabel,
  fontPx,
  mixColor,
  surfaceOf,
} from "./style";
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

/** pie 하위 차트. 없으면 보통 pie */
export type PieVariant = "doughnut" | "pie3d" | "sunburst";

/** sunburst 바깥 고리 조각 */
export type PieChildSlice = {
  /** 부모 조각 범주 */
  parent: string;
  /** legend 컬럼 값 */
  category: string;
  value: number;
  /** 부모 조각 안에서의 비율 */
  ratio: number;
  start: number;
  end: number;
  color: string;
};

export type PieMeta = {
  chartType: "pie";
  /** 하위 차트. 없으면 보통 pie */
  variant?: PieVariant;
  plot: { left: number; top: number; width: number; height: number };
  /** 고정 좌표 공간: 그림 영역 픽셀과 1:1 */
  x: AxisMeta;
  y: AxisMeta;
  /** 원의 중심(PNG 좌표)과 반지름(px) */
  center: { x: number; y: number };
  radius: number;
  /** pie3d: 윗면 타원의 세로 반지름. 없으면 원(= radius) */
  radiusY?: number;
  /** doughnut·sunburst: 가운데 빈 곳의 반지름 */
  innerRadius?: number;
  /** sunburst: 안쪽 고리(조각)의 바깥 반지름. 그 밖이 바깥 고리(children)다. */
  ring?: number;
  /** 보이는 조각만, 그린 순서대로 */
  slices: PieSlice[];
  /** sunburst 바깥 고리 조각 */
  children?: PieChildSlice[];
  /** 보이는 조각 합계 */
  total: number;
  agg?: AggFn;
  /** 선택 영역 안에 중심점이 든 조각 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type PieInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  /** 큰 순 조각. legend.values와 같은 순서다. */
  slices: PieSliceValue[];
  agg?: AggFn;
  /** 하위 차트. 없으면 보통 pie */
  variant?: PieVariant;
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
/** doughnut 가운데 빈 곳의 반지름 비율 */
const DOUGHNUT_HOLE = 0.55;
/** sunburst: 가운데 빈 곳과 안쪽 고리 바깥 끝의 반지름 비율 */
const SUNBURST_HOLE = 0.18;
const SUNBURST_RING = 0.6;
/** pie3d: 눕힌 원의 세로/가로 비율과 옆면 두께(반지름 대비) */
const TILT = 0.55;
const DEPTH = 0.14;

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

/**
 * sunburst 바깥 고리: 보이는 조각마다 children을 값 비율대로 조각 각도 안에 나눈다.
 * 색은 부모 조각 색에서 배경색 쪽으로 조금씩 옅게 한다.
 */
export function layoutChildren(slices: readonly PieSlice[], surface: string) {
  const out: PieChildSlice[] = [];
  for (const s of slices) {
    const children = s.children ?? [];
    const sum = children.reduce((acc, c) => acc + c.value, 0);
    if (sum <= 0) continue;
    let angle = s.start;
    children.forEach((c, k) => {
      const ratio = c.value / sum;
      const start = angle;
      angle += ratio * (s.end - s.start);
      out.push({
        parent: s.category,
        category: c.category,
        value: c.value,
        ratio,
        start,
        end: angle,
        color: mixColor(
          s.color,
          surface,
          0.12 + (0.5 * k) / Math.max(1, children.length - 1),
        ),
      });
    });
  }
  return out;
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

/** 점 글자(pointLabel) 자리: top은 원 바깥, center는 조각 가운데(대표점), bottom은 중심 가까이 */
const POINT_LABEL_RATIO = { top: 1, center: CENTROID_RATIO, bottom: 0.35 };
const OUTSIDE_GAP = 10;

/** 점 글자를 놓는 PNG 좌표 */
export function pointLabelAnchor(
  center: { x: number; y: number },
  radius: number,
  slice: Pick<PieSlice, "start" | "end">,
  position: keyof typeof POINT_LABEL_RATIO,
): [number, number] {
  const mid = (slice.start + slice.end) / 2;
  const r =
    radius * POINT_LABEL_RATIO[position] +
    (position === "top" ? OUTSIDE_GAP : 0);
  return [center.x + Math.cos(mid) * r, center.y + Math.sin(mid) * r];
}

/** 배경 위 비율 글자 색: 밝은 조각에는 검은 글자, 어두운 조각에는 흰 글자 */
function labelColor(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? THEME.textPrimary : "#fff";
}

/** 원 위 각도 angle, 반지름 r 자리 (pie3d면 세로를 눕힌 비율 k만큼 줄인다) */
function onRing(
  center: { x: number; y: number },
  r: number,
  angle: number,
  k = 1,
): [number, number] {
  return [center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r * k];
}

/** 부채꼴(inner > 0이면 고리 조각) path. k는 세로 비율(pie3d) */
function wedge(
  ctx: Ctx,
  center: { x: number; y: number },
  outer: number,
  inner: number,
  start: number,
  end: number,
  k = 1,
) {
  ctx.beginPath();
  const full = end - start >= Math.PI * 2 - 1e-9;
  if (inner <= 0) {
    if (!full) ctx.moveTo(center.x, center.y);
    ctx.ellipse(center.x, center.y, outer, outer * k, 0, start, end);
    ctx.closePath();
    return;
  }
  ctx.ellipse(center.x, center.y, outer, outer * k, 0, start, end);
  if (full) ctx.moveTo(...onRing(center, inner, end, k));
  ctx.ellipse(center.x, center.y, inner, inner * k, 0, end, start, true);
  ctx.closePath();
}

export function renderPie(
  ctx: Ctx,
  input: PieInput,
  progress: ProgressFn,
): PieMeta {
  const { width, height, legend, variant } = input;
  const o = optionsOf(input);
  const { shape } = o;
  const { slices, total } = layoutPie(
    input.slices,
    legend.colors,
    hiddenIndexes(legend),
  );
  progress("aggregate", 1);

  drawPanel(ctx, width, height, o);
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, 0, legend, o);
  const space = fixedSpace(plot);
  const pad = input.compact ? 0 : PIE_PAD;
  const tilted = variant === "pie3d";
  /** 세로 비율: 3D는 원을 눕혀 타원으로 그린다. */
  const k = tilted ? TILT : 1;
  // 3D는 윗면 타원(2 × 세로 반지름)과 옆면 두께가 그림 영역 높이에 들어가야 한다.
  const radius = Math.max(
    1,
    tilted
      ? Math.min(
          plot.width / 2 - pad,
          (plot.height - pad * 2) / (2 * TILT + DEPTH),
        )
      : Math.min(plot.width, plot.height) / 2 - pad,
  );
  const depth = tilted ? radius * DEPTH : 0;
  const center = {
    x: plot.left + plot.width / 2,
    y: plot.top + plot.height / 2 - depth / 2,
  };
  const inner =
    variant === "doughnut"
      ? radius * DOUGHNUT_HOLE
      : variant === "sunburst"
        ? radius * SUNBURST_HOLE
        : 0;
  /** 조각(안쪽 고리)의 바깥 반지름. sunburst만 바깥 고리 자리를 남긴다. */
  const sliceOuter = variant === "sunburst" ? radius * SUNBURST_RING : radius;
  const surface = surfaceOf(o);
  const children =
    variant === "sunburst" ? layoutChildren(slices, surface) : undefined;
  /** 조각의 대표점(선택 판정·비율 글자) 반지름 */
  const centroidR =
    inner > 0 ? (inner + sliceOuter) / 2 : sliceOuter * CENTROID_RATIO;
  const centroidOf = (s: Pick<PieSlice, "start" | "end">) =>
    onRing(center, centroidR, (s.start + s.end) / 2, k);

  const inSelection = input.selection && regionTester(input.selection);
  const inside = slices.map(
    (s) => !inSelection || inSelection(...space.toData(...centroidOf(s))),
  );
  const selectedCount = inside.filter(Boolean).length;

  // ── 조각 (render) ─────────────────────────────────────────────
  // shape: brush는 채우기만, border는 조각 색 테두리만, both는 채우기 + borderWidth만큼 배경색 테두리
  const opacity = alphaOf(shape.transparency);
  const paint = (color: string) => {
    if (shape.style !== "border") {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (shape.style === "border" || shape.borderWidth > 0) {
      ctx.strokeStyle =
        shape.style === "border" ? color : borderOf(shape, surface);
      ctx.lineWidth = Math.max(1, shape.borderWidth);
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };
  if (tilted) {
    // 3D 옆면: 앞쪽 반원(0 ~ π)에 걸친 부분만 보인다. 조각 색을 어둡게 칠한다.
    for (const [i, s] of slices.entries()) {
      const a = Math.max(s.start, 0);
      const b = Math.min(s.end, Math.PI);
      if (a >= b) continue;
      ctx.globalAlpha = opacity * (inside[i] ? 1 : o.shape.dimOpacity);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, radius, radius * k, 0, a, b);
      ctx.lineTo(...onRing({ x: center.x, y: center.y + depth }, radius, b, k));
      ctx.ellipse(
        center.x,
        center.y + depth,
        radius,
        radius * k,
        0,
        b,
        a,
        true,
      );
      ctx.closePath();
      paint(mixColor(s.color, "#000000", 0.28));
    }
  }
  for (const [i, s] of slices.entries()) {
    ctx.globalAlpha = opacity * (inside[i] ? 1 : o.shape.dimOpacity);
    wedge(ctx, center, sliceOuter, inner, s.start, s.end, k);
    paint(s.color);
  }
  if (children) {
    // 바깥 고리: 부모 조각이 선택 밖이면 함께 흐리게
    const parentInside = new Map(slices.map((s, i) => [s.category, inside[i]]));
    for (const c of children) {
      ctx.globalAlpha =
        opacity * (parentInside.get(c.parent) ? 1 : o.shape.dimOpacity);
      wedge(ctx, center, radius, sliceOuter + SEPARATOR, c.start, c.end);
      paint(c.color);
    }
  }
  ctx.globalAlpha = 1;
  if (shape.style !== "border") {
    // 조각 경계: 안쪽 끝에서 바깥으로 배경색 선
    ctx.strokeStyle = surface;
    ctx.lineWidth = SEPARATOR;
    ctx.beginPath();
    if (slices.length > 1) {
      for (const s of slices) {
        ctx.moveTo(...onRing(center, inner, s.start, k));
        ctx.lineTo(...onRing(center, sliceOuter, s.start, k));
      }
    }
    for (const c of children ?? []) {
      ctx.moveTo(...onRing(center, sliceOuter, c.start));
      ctx.lineTo(...onRing(center, radius, c.start));
    }
    ctx.stroke();
  }
  progress("render", 0.8);

  if (!input.compact) {
    // ── 비율 글자 (점 글자를 켜면 그 자리를 점 글자가 쓴다) ──────────
    ctx.font = `600 ${fontPx(o, 11)}px ${THEME.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = o.pointLabel;
    if (label.visible) {
      // 조각 값. 겹치면 건너뛰고, 위치는 바깥(top)·조각 가운데(center)·안쪽(bottom)
      const guard = createLabelGuard();
      const font = fontPx(o, 10, label.fontSize);
      for (const [i, s] of slices.entries()) {
        const [ax, ay] =
          label.position === "center"
            ? centroidOf(s)
            : pointLabelAnchor(center, sliceOuter, s, label.position);
        const ly =
          center.y + (ay - center.y) * (label.position === "center" ? 1 : k);
        ctx.globalAlpha = inside[i] ? 1 : 0.4;
        drawPointLabel(
          ctx,
          ax,
          ly,
          s.value,
          { ...label, position: "center" },
          font,
          guard,
        );
      }
      ctx.globalAlpha = 1;
    } else if (radius >= 40) {
      for (const [i, s] of slices.entries()) {
        if (s.ratio < LABEL_MIN_RATIO) continue;
        const [lx, ly] = centroidOf(s);
        ctx.globalAlpha = inside[i] ? 1 : 0.4;
        ctx.fillStyle = labelColor(s.color);
        ctx.fillText(`${Math.round(s.ratio * 100)}%`, lx, ly);
      }
      ctx.globalAlpha = 1;
    }
    // doughnut 가운데: 보이는 조각 합계. 더해서 뜻이 있는 통계 함수(합계·개수)일 때만 쓴다 (평균의 합은 뜻이 없다).
    const additive = !input.agg || input.agg === "sum" || input.agg === "count";
    if (
      variant === "doughnut" &&
      additive &&
      slices.length > 0 &&
      inner >= 28
    ) {
      ctx.fillStyle = THEME.textSecondary;
      ctx.font = `${fontPx(o, 10)}px ${THEME.font}`;
      ctx.fillText(
        input.agg ? AGG_LABELS[input.agg] : "합계",
        center.x,
        center.y - 9,
      );
      ctx.fillStyle = THEME.textPrimary;
      ctx.font = `600 ${fontPx(o, 13)}px ${THEME.font}`;
      ctx.fillText(
        total.toLocaleString("ko-KR", { maximumFractionDigits: 2 }),
        center.x,
        center.y + 8,
      );
    }
    if (slices.length === 0) drawEmpty(ctx, plot, "보이는 조각이 없습니다", o);

    drawHeader(
      ctx,
      plot,
      input.title,
      [
        input.agg ? AGG_LABELS[input.agg] : "",
        `${slices.length}개 조각`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );
  }

  // ── legend ──────────────────────────────────────────────────────
  const legendMeta = input.compact
    ? undefined
    : drawLegendAround(ctx, legend, plot, 0, o);

  if (input.selection) {
    drawSelection(ctx, input.selection, space.px, space.py, THEME.selection);
  }
  progress("render", 1);

  return {
    chartType: "pie",
    ...(variant ? { variant } : {}),
    plot,
    x: space.x,
    y: space.y,
    center,
    radius,
    ...(tilted ? { radiusY: radius * k } : {}),
    ...(inner > 0 ? { innerRadius: inner } : {}),
    ...(variant === "sunburst" ? { ring: sliceOuter, children } : {}),
    // 툴팁은 조각의 children을 쓰지 않는다 (바깥 고리는 children 목록으로 준다).
    slices: slices.map(({ children: _children, ...rest }) => rest),
    total,
    agg: input.agg,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
