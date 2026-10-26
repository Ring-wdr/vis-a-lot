// sankey 렌더러. 왼쪽 열은 출발 노드(x 값), 오른쪽 열은 도착 노드(y 값)이고, 흐름 굵기는 집계값이다.
// 배치는 d3-sankey로 계산하고 캔버스에 직접 그린다. 이동·확대가 없어 좌표 공간을 고정한다:
// 데이터 좌표 x는 그림 영역 왼쪽에서 오른쪽으로 0..plot.width, y는 아래에서 위로 0..plot.height (픽셀과 1:1).
// 그래서 선택 영역(데이터 좌표)을 다른 차트와 같은 방식으로 판정한다.

import {
  type SankeyLink as LayoutLink,
  type SankeyNode as LayoutNode,
  sankey,
  sankeyJustify,
} from "d3-sankey";
import type { SankeyLink } from "../data/sankey-data";
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
import { type AxisMeta, compactPlot, type ProgressFn } from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import { alphaOf, drawPanel, fontPx, lineWidthOf, mixColor } from "./style";
import { THEME } from "./theme";

type Plot = { left: number; top: number; width: number; height: number };

export type SankeyNodeMeta = {
  name: string;
  side: "source" | "target";
  /** PNG 좌표 */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 들어오는 흐름 합 (출발 노드는 0) */
  in: number;
  /** 나가는 흐름 합 (도착 노드는 0) */
  out: number;
  /** 출발 노드의 legend 인덱스 (도착 노드는 없다) */
  legend?: number;
};

export type SankeyLinkMeta = {
  /** nodes 인덱스 */
  source: number;
  target: number;
  value: number;
  /** 출발 노드 오른쪽 끝(nodes[source].x1)과 도착 노드 왼쪽 끝(nodes[target].x0)에서의 가운데 y (PNG 좌표) */
  y0: number;
  y1: number;
  /** 흐름 굵기(px) */
  width: number;
};

export type SankeyMeta = {
  chartType: "sankey";
  plot: Plot;
  /** 고정 좌표 공간: [0, plot.width] */
  x: AxisMeta;
  /** 고정 좌표 공간: [0, plot.height] (아래가 0) */
  y: AxisMeta;
  agg: AggFn;
  nodes: SankeyNodeMeta[];
  links: SankeyLinkMeta[];
  /** 선택 영역 안에 든 흐름·노드 수. 선택이 없으면 없다. */
  selected?: number;
  legend?: LegendMeta;
};

export type SankeyInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  /** 출발 노드 이름. 순서가 legend 인덱스다. */
  sources: string[];
  targets: string[];
  links: SankeyLink[];
  agg: AggFn;
  /** 출발 노드 legend. 끈 값의 흐름은 빼고 배치한다. */
  legend: LegendInput;
  shapes: readonly Shape[];
  /** 선택 영역. 바깥 흐름·노드는 흐리게 그린다. */
  selection?: Region;
  /** 섬네일: 제목·라벨·legend 없이 그림 영역만 그린다. */
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

const NODE_WIDTH = 12;
const NODE_PADDING = 10;
const LABEL_GAP = 6;
/** 노드 라벨 자리의 폭 상한 (PNG 폭 대비) */
const LABEL_MAX_RATIO = 0.22;
const DIM = 0.2;
/** 도착 노드 색 */
const TARGET_COLOR = "#8a8984";

type NodeDatum = { id: string; name: string; side: "source" | "target" };
type LinkDatum = { value: number };

/**
 * 흐름을 그림 영역에 배치한다. 끈 출발 노드(off)의 흐름은 빼고, 흐름이 하나도 없는 노드는 놓지 않는다.
 * 노드는 sources·targets 순서(흐름이 큰 순서)대로 위에서부터 쌓는다.
 */
export function layoutSankey(
  input: Pick<SankeyInput, "sources" | "targets" | "links">,
  off: readonly boolean[],
  plot: Plot,
): { nodes: SankeyNodeMeta[]; links: SankeyLinkMeta[] } {
  const links = input.links.filter((l) => !off[l.source] && l.value > 0);
  if (links.length === 0) return { nodes: [], links: [] };
  const usedSources = new Set(links.map((l) => l.source));
  const usedTargets = new Set(links.map((l) => l.target));
  const nodes: NodeDatum[] = [
    ...input.sources.flatMap((name, i) =>
      usedSources.has(i)
        ? [{ id: `s${i}`, name, side: "source" as const }]
        : [],
    ),
    ...input.targets.flatMap((name, j) =>
      usedTargets.has(j)
        ? [{ id: `t${j}`, name, side: "target" as const }]
        : [],
    ),
  ];
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const graph = sankey<NodeDatum, LinkDatum>()
    .nodeId((n) => n.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .nodeSort(
      (a, b) => (order.get(a.id) as number) - (order.get(b.id) as number),
    )
    .extent([
      [plot.left, plot.top],
      [plot.left + plot.width, plot.top + plot.height],
    ])({
    nodes: nodes.map((n) => ({ ...n })),
    links: links.map((l) => ({
      source: `s${l.source}`,
      target: `t${l.target}`,
      value: l.value,
    })),
  });
  const laid = graph.nodes as LayoutNode<NodeDatum, LinkDatum>[];
  const indexOf = new Map(laid.map((n, i) => [n, i]));
  return {
    nodes: laid.map((n) => ({
      name: n.name,
      side: n.side,
      x0: n.x0 ?? 0,
      y0: n.y0 ?? 0,
      x1: n.x1 ?? 0,
      y1: n.y1 ?? 0,
      in: n.side === "target" ? (n.value ?? 0) : 0,
      out: n.side === "source" ? (n.value ?? 0) : 0,
      ...(n.side === "source" ? { legend: Number(n.id.slice(1)) } : {}),
    })),
    links: (graph.links as LayoutLink<NodeDatum, LinkDatum>[]).map((l) => ({
      source: indexOf.get(l.source as LayoutNode<NodeDatum, LinkDatum>) ?? 0,
      target: indexOf.get(l.target as LayoutNode<NodeDatum, LinkDatum>) ?? 0,
      value: l.value,
      y0: l.y0 ?? 0,
      y1: l.y1 ?? 0,
      width: l.width ?? 0,
    })),
  };
}

/** 흐름 가운데 곡선의 시작·끝 x (출발 노드 오른쪽, 도착 노드 왼쪽) */
export function linkEnds(
  meta: Pick<SankeyMeta, "nodes">,
  link: SankeyLinkMeta,
) {
  return { xs: meta.nodes[link.source].x1, xt: meta.nodes[link.target].x0 };
}

/** 흐름의 대표 PNG 좌표: 곡선 가운데점 */
export function linkMidpoint(
  meta: Pick<SankeyMeta, "nodes">,
  link: SankeyLinkMeta,
): [number, number] {
  const { xs, xt } = linkEnds(meta, link);
  return [(xs + xt) / 2, (link.y0 + link.y1) / 2];
}

/** 노드의 대표 PNG 좌표: 사각형 가운데 */
export function nodeCenter(node: SankeyNodeMeta): [number, number] {
  return [(node.x0 + node.x1) / 2, (node.y0 + node.y1) / 2];
}

/** PNG 좌표 → 고정 데이터 좌표 (x는 그림 왼쪽부터, y는 그림 아래부터) */
export function toData(plot: Plot, px: number, py: number): [number, number] {
  return [px - plot.left, plot.top + plot.height - py];
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

/** 출발·도착 노드 라벨 자리의 폭. 가장 긴 이름에 맞추되 상한을 둔다. */
function labelWidth(ctx: Ctx, names: readonly string[], width: number) {
  const widest = Math.max(0, ...names.map((n) => ctx.measureText(n).width));
  return Math.ceil(Math.min(widest, width * LABEL_MAX_RATIO));
}

function traceLink(ctx: Ctx, xs: number, xt: number, link: SankeyLinkMeta) {
  const xm = (xs + xt) / 2;
  ctx.beginPath();
  ctx.moveTo(xs, link.y0);
  ctx.bezierCurveTo(xm, link.y0, xm, link.y1, xt, link.y1);
}

export function renderSankey(
  ctx: Ctx,
  input: SankeyInput,
  progress: ProgressFn,
): SankeyMeta {
  const { width, height } = input;
  const o = optionsOf(input);
  const { shape } = o;
  const off = hiddenIndexes(input.legend);
  const inSelection = input.selection && regionTester(input.selection);
  const font = fontPx(o, 11);

  drawPanel(ctx, width, height, o);

  // ── 그림 영역: 왼쪽·오른쪽에 노드 라벨 자리를 둔다 ──────────────
  ctx.font = `${font}px ${THEME.font}`;
  const leftLabel = input.compact ? 0 : labelWidth(ctx, input.sources, width);
  const rightLabel = input.compact ? 0 : labelWidth(ctx, input.targets, width);
  const frame = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, leftLabel, input.legend, o);
  const plot: Plot = input.compact
    ? frame
    : {
        left: frame.left,
        top: frame.top,
        width: Math.max(10, frame.width - rightLabel - LABEL_GAP),
        // 아래에는 x축 눈금이 없어 framePlot이 비워 둔 자리를 조금 더 쓴다.
        height: frame.height + 12,
      };
  const layout = layoutSankey(input, off, plot);
  progress("aggregate", 1);

  // 선택: 흐름은 곡선 가운데점, 노드는 사각형 가운데가 영역(데이터 좌표) 안이면 고른다.
  const inside = (p: [number, number]) =>
    !inSelection || inSelection(...toData(plot, p[0], p[1]));
  const nodeIn = layout.nodes.map((n) => inside(nodeCenter(n)));
  const linkIn = layout.links.map((l) => inside(linkMidpoint(layout, l)));
  const selectedCount = inSelection
    ? nodeIn.filter(Boolean).length + linkIn.filter(Boolean).length
    : 0;
  const colorOf = (node: SankeyNodeMeta) =>
    node.legend !== undefined
      ? (input.legend.colors[node.legend] ?? TARGET_COLOR)
      : TARGET_COLOR;

  // shape 투명도는 흐름·노드 모두에, 선 굵기(size.lineWidth)는 가장 가는 흐름의 굵기에 쓴다.
  const opacity = alphaOf(shape.transparency);
  const minLink = lineWidthOf(o, 1);

  // ── 흐름 (render) ─────────────────────────────────────────────
  ctx.save();
  layout.links.forEach((link, i) => {
    const { xs, xt } = linkEnds(layout, link);
    ctx.strokeStyle = colorOf(layout.nodes[link.source]);
    ctx.globalAlpha = opacity * (linkIn[i] ? 1 : DIM);
    ctx.lineWidth = Math.max(minLink, link.width);
    traceLink(ctx, xs, xt, link);
    ctx.stroke();
    if (i % 200 === 0) progress("render", i / layout.links.length);
  });
  ctx.globalAlpha = 1;

  // ── 노드 ──────────────────────────────────────────────────────
  // shape: brush는 채우기만, border는 노드 색 테두리만, both는 채우기 + 진한 색 테두리(borderWidth)
  layout.nodes.forEach((node, i) => {
    const color = colorOf(node);
    ctx.globalAlpha = opacity * (nodeIn[i] ? 1 : DIM);
    const w = node.x1 - node.x0;
    const h = Math.max(1, node.y1 - node.y0);
    if (shape.style !== "border") {
      ctx.fillStyle = color;
      ctx.fillRect(node.x0, node.y0, w, h);
    }
    if (shape.style === "border" || shape.borderWidth > 0) {
      ctx.strokeStyle =
        shape.style === "border" ? color : mixColor(color, "#000000", 0.3);
      ctx.lineWidth = Math.max(1, shape.borderWidth);
      ctx.strokeRect(node.x0, node.y0, w, h);
    }
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    // ── 노드 라벨: 출발은 노드 왼쪽, 도착은 노드 오른쪽 ────────────
    ctx.font = `${font}px ${THEME.font}`;
    ctx.textBaseline = "middle";
    layout.nodes.forEach((node, i) => {
      const source = node.side === "source";
      ctx.fillStyle = nodeIn[i] ? THEME.textSecondary : THEME.textMuted;
      ctx.textAlign = source ? "right" : "left";
      ctx.fillText(
        truncate(ctx, node.name, source ? leftLabel : rightLabel),
        source ? node.x0 - LABEL_GAP : node.x1 + LABEL_GAP,
        (node.y0 + node.y1) / 2,
      );
    });
    if (layout.links.length === 0) {
      ctx.fillStyle = THEME.textMuted;
      ctx.textAlign = "center";
      ctx.fillText(
        "그릴 흐름이 없습니다",
        plot.left + plot.width / 2,
        plot.top + plot.height / 2,
      );
    }

    // ── 제목 ──────────────────────────────────────────────────────
    drawTitle(
      ctx,
      frame,
      input.title,
      [
        AGG_LABELS[input.agg],
        `${layout.links.length}개 흐름`,
        inSelection ? `${selectedCount}개 선택` : "",
      ],
      o,
    );

    // ── legend (출발 노드) ────────────────────────────────────────
    legendMeta = drawLegendAround(ctx, input.legend, frame, leftLabel, o);
  }

  // 고정 좌표 공간의 데이터 좌표 → PNG 좌표
  const px = (v: number) => plot.left + v;
  const py = (v: number) => plot.top + plot.height - v;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  if (input.selection) {
    drawSelection(ctx, input.selection, px, py, THEME.selection);
  }
  drawShapes(ctx, input.shapes, px, py);
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "sankey",
    plot,
    x: { kind: "number", domain: [0, plot.width] },
    y: { kind: "number", domain: [0, plot.height] },
    agg: input.agg,
    nodes: layout.nodes,
    links: layout.links,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
