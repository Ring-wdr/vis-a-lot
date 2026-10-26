// treemap 렌더러. x 범주가 잎, y 집계값이 넓이다 (0 이하 값은 뺀다). legend가 있으면 legend 값이 부모 묶음이다.
// 레이아웃은 [0,1] x [0,1] 데이터 좌표에 놓는다 (y는 위로 증가). 그래서 확대(그 영역을 키워 보기)·이동·선택·도형이
// 다른 차트처럼 데이터 좌표로 동작한다. 칸 비율은 확대하지 않은 그림 영역 크기로 squarify해 정사각형에 가깝게 한다.

import {
  type HierarchyRectangularNode,
  hierarchy,
  treemap,
  treemapSquarify,
} from "d3-hierarchy";
import { scaleLinear } from "d3-scale";
import { AGG_LABELS, type AggFn } from "../data/schema";
import { drawTitle } from "./frame";
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
  alphaOf,
  createLabelGuard,
  drawPanel,
  drawPointLabel,
  fontPx,
  surfaceOf,
} from "./style";
import { THEME } from "./theme";

/** 데이터 좌표의 사각형. y0이 아래, y1이 위다. */
export type TreemapRect = { x0: number; y0: number; x1: number; y1: number };

export type TreemapNode = TreemapRect & {
  name: string;
  /** legend 인덱스 (legend가 없으면 0) */
  g: number;
  value: number;
};

export type TreemapMeta = {
  chartType: "treemap";
  plot: { left: number; top: number; width: number; height: number };
  /** 레이아웃 좌표 [0,1] */
  x: AxisMeta;
  y: AxisMeta;
  agg: AggFn;
  /** 보이는 잎 값의 합. 툴팁 비율의 분모다. */
  total: number;
  leaves: TreemapNode[];
  /** legend가 있을 때의 부모 묶음 */
  parents: TreemapNode[];
  /** 선택 영역 안에 가운데가 든 잎 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type TreemapInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  categories: string[];
  /** [범주][legend 값] 집계값 */
  bars?: (number | null)[][];
  agg: AggFn;
  color: string;
  legend?: LegendInput;
  view?: ItemView;
  shapes: readonly Shape[];
  /** 선택 영역. 가운데가 바깥인 잎은 흐리게 그린다. */
  selection?: Region;
  /** 섬네일: 제목·legend 없이 그림 영역만 그린다. */
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

/** 부모 묶음 이름 띠 높이(px, 확대하지 않았을 때) */
const PARENT_HEADER = 16;
const PAD = 2;
/** framePlot이 x축 눈금 글자에 두는 여백 중 되찾아 쓰는 높이 */
const AXIS_SPACE = 18;

type Datum = { name: string; g: number; value?: number; children?: Datum[] };

/**
 * 잎과 부모 묶음의 레이아웃. width·height(px) 비율로 squarify한 뒤 [0,1]로 줄이고 y를 뒤집는다.
 * 0 이하·빈 값과 숨긴 legend 값(off)은 뺀다. legendCount가 0이면 부모 없이 잎만 놓는다.
 */
export function layoutTreemap(
  categories: readonly string[],
  bars: readonly (readonly (number | null)[])[],
  legendCount: number,
  off: readonly boolean[],
  width: number,
  height: number,
  headers: boolean,
): { leaves: TreemapNode[]; parents: TreemapNode[] } {
  const leavesOf = (g: number): Datum[] =>
    categories.flatMap((name, i) => {
      const v = bars[i]?.[g];
      return v !== null && v !== undefined && v > 0 && Number.isFinite(v)
        ? [{ name, g, value: v }]
        : [];
    });
  const children: Datum[] =
    legendCount > 0
      ? Array.from({ length: legendCount }, (_, g) => g)
          .filter((g) => !off[g])
          .map((g) => ({ name: "", g, children: leavesOf(g) }))
          .filter((d) => (d.children?.length ?? 0) > 0)
      : leavesOf(0);
  const root = hierarchy<Datum>({ name: "", g: -1, children })
    .sum((d) => (d.children ? 0 : (d.value ?? 0)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const laid = treemap<Datum>()
    .tile(treemapSquarify)
    .size([w, h])
    .paddingInner(PAD)
    .paddingOuter((n) => (n.depth === 0 ? 0 : PAD))
    .paddingTop((n) => (n.depth === 1 && headers ? PARENT_HEADER : 0))(root);
  const toNode = (n: HierarchyRectangularNode<Datum>): TreemapNode => ({
    name: n.data.name,
    g: Math.max(0, n.data.g),
    value: n.value ?? 0,
    x0: n.x0 / w,
    x1: n.x1 / w,
    y0: 1 - n.y1 / h,
    y1: 1 - n.y0 / h,
  });
  return {
    leaves: laid
      .leaves()
      .filter((n) => n.depth > 0)
      .map(toNode),
    parents: legendCount > 0 ? (laid.children ?? []).map(toNode) : [],
  };
}

/** 사각형의 가운데. 선택 판정의 대표 좌표다. */
export function rectCenter(r: TreemapRect): [number, number] {
  return [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
}

/** 데이터 좌표의 점이 든 잎. 없으면 -1 */
export function leafAt(leaves: readonly TreemapRect[], x: number, y: number) {
  return leaves.findIndex(
    (r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1,
  );
}

/** 칸 위 글자색: 밝은 칸은 진한 글자, 어두운 칸은 흰 글자 */
function inkOn(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum =
    (0.2126 * ((n >> 16) & 255) +
      0.7152 * ((n >> 8) & 255) +
      0.0722 * (n & 255)) /
    255;
  return lum > 0.6 ? THEME.textPrimary : "#ffffff";
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return end <= 1 ? "" : `${text.slice(0, end)}…`;
}

const formatNumber = (v: number) =>
  Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** value.nullNumeric이 있으면 빈 값(null)을 그 값으로 채운다 (0 이하면 여전히 칸이 없다). */
export function fillNullBars(
  bars: readonly (readonly (number | null)[])[],
  fill: number | null,
): (number | null)[][] {
  return bars.map((row) => row.map((v) => v ?? fill));
}

export function renderTreemap(
  ctx: Ctx,
  input: TreemapInput,
  progress: ProgressFn,
): TreemapMeta {
  const o = optionsOf(input);
  const { width, height, view } = input;
  const off = hiddenIndexes(input.legend);
  const legendCount = input.legend?.values.length ?? 0;
  const inSelection = input.selection && regionTester(input.selection);

  drawPanel(ctx, width, height, o);

  // ── 레이아웃 (aggregate) ──────────────────────────────────────
  // 축 눈금 글자가 없으므로 framePlot이 x축 글자 자리로 비워 둔 아래 여백도 그림 영역으로 쓴다.
  // legend는 원래 자리(legendFrame) 기준으로 놓는다.
  const legendFrame = framePlot(ctx, width, height, 0, input.legend, o);
  const plot = input.compact
    ? compactPlot(width, height)
    : { ...legendFrame, height: legendFrame.height + AXIS_SPACE };
  const { leaves, parents } = layoutTreemap(
    input.categories,
    fillNullBars(input.bars ?? [], o.value.nullNumeric),
    legendCount,
    off,
    plot.width,
    plot.height,
    !input.compact,
  );
  const total = leaves.reduce((s, l) => s + l.value, 0);
  const xDomain: [number, number] = view?.x ?? [0, 1];
  const yDomain: [number, number] = view?.y ?? [0, 1];
  const x = scaleLinear()
    .domain(xDomain)
    .range([plot.left, plot.left + plot.width]);
  const y = scaleLinear()
    .domain(yDomain)
    .range([plot.top + plot.height, plot.top]);
  let selectedCount = 0;
  const selected = leaves.map((l) => {
    const inside = !inSelection || inSelection(...rectCenter(l));
    if (inSelection && inside) selectedCount++;
    return inside;
  });
  progress("aggregate", 1);

  // ── 제목, legend ──────────────────────────────────────────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawTitle(
      ctx,
      plot,
      input.title,
      [
        AGG_LABELS[input.agg],
        `${leaves.length}개 칸`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, legendFrame, 0, o)
      : undefined;
  }

  // ── 칸 (render) ────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  const colorOf = (g: number) =>
    legendCount > 0 ? (input.legend?.colors[g] ?? input.color) : input.color;
  const pxRect = (r: TreemapRect) => {
    const left = x(r.x0);
    const top = y(r.y1);
    return { left, top, w: x(r.x1) - left, h: y(r.y0) - top };
  };
  if (leaves.length === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `11px ${THEME.font}`;
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  }
  // 부모 묶음: 옅은 바탕과 이름 띠
  const font = fontPx(o, 11);
  ctx.font = `${font}px ${THEME.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const p of parents) {
    const r = pxRect(p);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = colorOf(p.g);
    ctx.fillRect(r.left, r.top, r.w, r.h);
    ctx.globalAlpha = 1;
    if (input.compact) continue;
    const name = input.legend?.values[p.g] ?? "";
    // 이름 띠는 확대한 만큼 커진다.
    const headerH = PARENT_HEADER / (yDomain[1] - yDomain[0]);
    const band = Math.min(r.h, headerH);
    if (band >= font + 1) {
      ctx.fillStyle = THEME.textSecondary;
      ctx.fillText(
        truncate(ctx, name, r.w - 8),
        r.left + 4,
        r.top + band / 2 + 1,
      );
    }
  }
  // 칸 모양: 채우기·테두리(style), 투명도, 테두리 굵기
  const { style, borderWidth, transparency } = o.shape;
  const alpha = alphaOf(transparency);
  const stroke = surfaceOf(o);
  // 점 글자(값)를 켜면 칸 안 값 줄 대신 점 글자로 적는다.
  const pointLabels = o.pointLabel.visible && !input.compact;
  const line = font + 3;
  leaves.forEach((l, k) => {
    const r = pxRect(l);
    if (r.left > plot.left + plot.width || r.left + r.w < plot.left) return;
    if (r.top > plot.top + plot.height || r.top + r.h < plot.top) return;
    const color = colorOf(l.g);
    ctx.globalAlpha = selected[k] ? alpha : alpha * 0.2;
    const w = Math.max(1, r.w);
    const h = Math.max(1, r.h);
    if (style !== "border") {
      ctx.fillStyle = color;
      ctx.fillRect(r.left, r.top, w, h);
    }
    if (style === "border" || borderWidth > 0) {
      const bw = style === "border" ? Math.max(1, borderWidth) : borderWidth;
      ctx.strokeStyle = style === "border" ? color : stroke;
      ctx.lineWidth = bw;
      ctx.strokeRect(
        r.left + bw / 2,
        r.top + bw / 2,
        Math.max(0, w - bw),
        Math.max(0, h - bw),
      );
    }
    ctx.globalAlpha = 1;
    // 들어갈 때만 이름(과 값)을 칸 안 왼쪽 위에 적는다. 테두리만 그린 칸은 바탕 위 글자색이다.
    if (!input.compact && r.w >= 28 && r.h >= font + 7) {
      ctx.fillStyle = !selected[k]
        ? THEME.textMuted
        : style === "border"
          ? THEME.textPrimary
          : inkOn(color);
      const name = truncate(ctx, l.name, r.w - 8);
      if (name) {
        ctx.fillText(name, r.left + 4, r.top + font - 1);
        if (!pointLabels && r.h >= font + 21) {
          const value = truncate(ctx, formatNumber(l.value), r.w - 8);
          ctx.globalAlpha = 0.85;
          ctx.fillText(value, r.left + 4, r.top + font - 1 + line);
          ctx.globalAlpha = 1;
        }
      }
    }
    if (k % 200 === 0) progress("render", k / leaves.length);
  });
  // 값 글자: 칸 가운데 기준, 겹치면 건너뛴다.
  if (pointLabels) {
    const guard = createLabelGuard();
    const labelFont = fontPx(o, 10, o.pointLabel.fontSize);
    for (const l of leaves) {
      const r = pxRect(l);
      if (r.w < 16 || r.h < labelFont + 4) continue;
      drawPointLabel(
        ctx,
        r.left + r.w / 2,
        r.top + r.h / 2,
        l.value,
        o.pointLabel,
        labelFont,
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
    chartType: "treemap",
    plot,
    x: { kind: "number", domain: xDomain },
    y: { kind: "number", domain: yDomain },
    agg: input.agg,
    total,
    leaves,
    parents,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
