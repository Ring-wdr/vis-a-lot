// 차트 종류별 툴팁 전략. 각 전략은 metadata만으로 커서 위치를 해석하고(hitTest),
// 툴팁에 보여줄 줄(rows)을 만든다. 서버 호출이 필요한 추가 컬럼은 rowId로 넘긴다.

import type {
  AxisMeta,
  CategoryMeta,
  HeatmapMeta,
  ItemMeta,
  SankeyMeta,
  ScatterMeta,
  TreemapMeta,
} from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import { formatValue } from "@/shared/lib/format";
import { groupSlot } from "./group-slot";
import { PointIndex } from "./point-index";
import { hitSankey, linkOutline } from "./sankey-hit";

export type TooltipRow = { label: string; value: string; emphasis?: boolean };

export type TooltipHit = {
  /** 점 하이라이트 위치 (PNG 좌표). scatter */
  marker?: { px: number; py: number };
  /** 가리킨 막대/상자를 감싸는 사각형 (PNG 좌표). bar, boxplot */
  highlight?: { x: number; y: number; width: number; height: number };
  /** 가리킨 흐름 띠의 윤곽 (SVG path, PNG 좌표). sankey */
  outline?: string;
  rows: TooltipRow[];
  /** 추가 컬럼을 서버에서 가져올 행. 없으면 서버 호출을 하지 않는다. */
  rowId?: number;
};

export type TooltipOptions = {
  /** scatter: 커서에서 가장 가까운 점(픽셀 기준으로 줄인 점)을 함께 보여줄지. 끄면 커서 좌표값만 보여준다. */
  nearest: boolean;
};

export type TooltipStrategy<M extends ItemMeta> = {
  /** metadata를 받았을 때 한 번 만드는 준비물 (공간 인덱스 등) */
  prepare: (meta: M) => unknown;
  /** px, py는 PNG 좌표. 그림 영역 밖이면 null */
  hitTest: (
    meta: M,
    prepared: unknown,
    px: number,
    py: number,
    options?: TooltipOptions,
  ) => TooltipHit | null;
};

/** 픽셀 → 데이터 값. 화면 y는 아래로 갈수록 커지므로 y축은 뒤집는다. */
export function invertAxis(
  axis: AxisMeta,
  start: number,
  length: number,
  pixel: number,
  flipped: boolean,
) {
  const t = (pixel - start) / length;
  const ratio = flipped ? 1 - t : t;
  return axis.domain[0] + ratio * (axis.domain[1] - axis.domain[0]);
}

const NEAREST_MAX_PX = 24;

export const scatterStrategy: TooltipStrategy<ScatterMeta> = {
  prepare: (meta) => new PointIndex(meta.points.px, meta.points.py),

  hitTest(meta, prepared, px, py, { nearest } = { nearest: true }) {
    const { plot } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (
      px < plot.left ||
      px > plot.left + plot.width ||
      py < plot.top ||
      py > plot.top + plot.height
    ) {
      return null;
    }
    const x = invertAxis(meta.x, plot.left, plot.width, px, false);
    const y = invertAxis(meta.y, plot.top, plot.height, py, true);
    const rows: TooltipRow[] = [
      { label: "커서 x", value: formatValue(x, meta.x.kind) },
      { label: "커서 y", value: formatValue(y, meta.y.kind) },
    ];
    // 가까운 점을 끄면 tooltip 컬럼도 가져오지 않는다 (가까운 점의 행에서 읽는 값이다).
    if (!nearest) return { rows };
    const index = (prepared as PointIndex).nearest(px, py, NEAREST_MAX_PX);
    if (index === -1) return { rows };
    const { points } = meta;
    rows.push(
      {
        label: "가까운 점 x",
        value: formatValue(points.x[index], meta.x.kind),
        emphasis: true,
      },
      {
        label: "가까운 점 y",
        value: formatValue(points.y[index], meta.y.kind),
        emphasis: true,
      },
    );
    const g = points.g?.[index];
    if (meta.legend && g !== undefined) {
      rows.push({
        label: meta.legend.title,
        value: meta.legend.values[g],
        emphasis: true,
      });
    }
    return {
      marker: { px: points.px[index], py: points.py[index] },
      rows,
      rowId: points.id[index],
    };
  },
};

/** legend 상자 위에서는 툴팁 대신 legend 색 선택이 동작한다. */
export function inLegendBox(meta: ItemMeta, px: number, py: number) {
  const box = meta.legend?.box;
  return (
    !!box &&
    px >= box.x &&
    px <= box.x + box.width &&
    py >= box.y &&
    py <= box.y + box.height
  );
}

/**
 * 범주 인덱스 축에서 커서가 가리키는 막대/상자.
 * 범주 안에 legend 값별로 나란히 놓였으면 그중 어느 칸인지까지 찾는다.
 */
function hitCategory(meta: CategoryMeta, px: number, py: number) {
  const { plot } = meta;
  if (
    px < plot.left ||
    px > plot.left + plot.width ||
    py < plot.top ||
    py > plot.top + plot.height
  ) {
    return undefined;
  }
  const index = Math.round(
    invertAxis(meta.x, plot.left, plot.width, px, false),
  );
  if (index < 0 || index >= meta.categories.length) return undefined;
  const center =
    plot.left +
    ((index - meta.x.domain[0]) / (meta.x.domain[1] - meta.x.domain[0])) *
      plot.width;
  if (Math.abs(px - center) > meta.markWidth / 2 + HIT_SLOP_PX)
    return undefined;
  const left = center - meta.markWidth / 2;
  const g = Math.min(
    meta.groupCount - 1,
    Math.max(0, Math.floor(((px - left) / meta.markWidth) * meta.groupCount)),
  );
  const { cx, width } = groupSlot(
    center,
    meta.markWidth,
    meta.groupCount,
    g,
    meta.groupGap,
  );
  return { index, g, cx, width };
}

function yToPx(meta: CategoryMeta, v: number) {
  const { plot } = meta;
  const [d0, d1] = meta.y.domain;
  return plot.top + plot.height - ((v - d0) / (d1 - d0)) * plot.height;
}

/** 범주 줄과, legend가 있으면 legend 값 줄 */
function categoryRows(meta: CategoryMeta, index: number, g: number) {
  const rows: TooltipRow[] = [{ label: "범주", value: meta.categories[index] }];
  if (meta.legend) {
    rows.push({ label: meta.legend.title, value: meta.legend.values[g] });
  }
  return rows;
}

const HIT_SLOP_PX = 3;
const HIGHLIGHT_PAD = 3;

/** 막대/상자의 세로 범위(데이터 값)를 감싸는 사각형. 그림 영역 밖으로는 나가지 않는다. */
function highlightRect(
  meta: CategoryMeta,
  cx: number,
  width: number,
  from: number,
  to: number,
) {
  const { plot } = meta;
  const top = Math.max(
    plot.top,
    Math.min(yToPx(meta, from), yToPx(meta, to)) - HIGHLIGHT_PAD,
  );
  const bottom = Math.min(
    plot.top + plot.height,
    Math.max(yToPx(meta, from), yToPx(meta, to)) + HIGHLIGHT_PAD,
  );
  return {
    x: cx - width / 2 - HIGHLIGHT_PAD,
    y: top,
    width: width + HIGHLIGHT_PAD * 2,
    height: Math.max(1, bottom - top),
  };
}

export const barStrategy: TooltipStrategy<CategoryMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    if (inLegendBox(meta, px, py)) return null;
    const hit = hitCategory(meta, px, py);
    const value = hit && meta.bars?.[hit.index]?.[hit.g];
    if (!hit || value === undefined || value === null) return null;
    return {
      highlight: highlightRect(meta, hit.cx, hit.width, 0, value),
      rows: [
        ...categoryRows(meta, hit.index, hit.g),
        {
          label: meta.agg ? AGG_LABELS[meta.agg] : "값",
          value: formatValue(value, "number"),
          emphasis: true,
        },
      ],
    };
  },
};

export const boxplotStrategy: TooltipStrategy<CategoryMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    if (inLegendBox(meta, px, py)) return null;
    const hit = hitCategory(meta, px, py);
    const box = hit && meta.boxes?.[hit.index]?.[hit.g];
    if (!hit || !box) return null;
    const num = (v: number) => formatValue(v, "number");
    return {
      highlight: highlightRect(meta, hit.cx, hit.width, box.lo, box.hi),
      rows: [
        ...categoryRows(meta, hit.index, hit.g),
        { label: "개수", value: num(box.n) },
        { label: "최댓값(수염)", value: num(box.hi) },
        { label: "Q3", value: num(box.q3) },
        { label: "중앙값", value: num(box.median), emphasis: true },
        { label: "Q1", value: num(box.q1) },
        { label: "최솟값(수염)", value: num(box.lo) },
        { label: "평균", value: num(box.mean) },
        { label: "이상치", value: `${num(box.outlierCount)}개` },
      ],
    };
  },
};

/** 흐름이면 출발 → 도착과 값, 노드면 이름과 들어오고 나가는 합 */
export const sankeyStrategy: TooltipStrategy<SankeyMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    if (inLegendBox(meta, px, py)) return null;
    const hit = hitSankey(meta, px, py);
    if (!hit) return null;
    const num = (v: number) => formatValue(v, "number");
    const valueLabel = AGG_LABELS[meta.agg];
    if (hit.kind === "link") {
      const link = meta.links[hit.index];
      return {
        outline: linkOutline(meta, link),
        rows: [
          { label: "출발", value: meta.nodes[link.source].name },
          { label: "도착", value: meta.nodes[link.target].name },
          { label: valueLabel, value: num(link.value), emphasis: true },
        ],
      };
    }
    const node = meta.nodes[hit.index];
    return {
      highlight: {
        x: node.x0 - HIGHLIGHT_PAD,
        y: node.y0 - HIGHLIGHT_PAD,
        width: node.x1 - node.x0 + HIGHLIGHT_PAD * 2,
        height: Math.max(1, node.y1 - node.y0) + HIGHLIGHT_PAD * 2,
      },
      rows: [
        {
          label: node.side === "source" ? "출발 노드" : "도착 노드",
          value: node.name,
        },
        {
          label: "들어오는 합",
          value: num(node.in),
          emphasis: node.side === "target",
        },
        {
          label: "나가는 합",
          value: num(node.out),
          emphasis: node.side === "source",
        },
      ],
    };
  },
};

/** 데이터 좌표 → PNG 좌표 (범주 인덱스 공간의 칸 경계를 그릴 때) */
function dataToPx(meta: ItemMeta, x: number, y: number) {
  const { plot } = meta;
  const [x0, x1] = meta.x.domain;
  const [y0, y1] = meta.y.domain;
  return {
    px: plot.left + ((x - x0) / (x1 - x0)) * plot.width,
    py: plot.top + plot.height - ((y - y0) / (y1 - y0)) * plot.height,
  };
}

/** 사각형을 그림 영역 안으로 잘라낸다. */
function clipToPlot(
  meta: ItemMeta,
  rect: { x: number; y: number; width: number; height: number },
) {
  const { plot } = meta;
  const left = Math.max(plot.left, rect.x);
  const top = Math.max(plot.top, rect.y);
  const right = Math.min(plot.left + plot.width, rect.x + rect.width);
  const bottom = Math.min(plot.top + plot.height, rect.y + rect.height);
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/** heatmap: 커서 아래 칸(x·y 범주 인덱스를 반올림)의 범주와 값 */
export const heatmapStrategy: TooltipStrategy<HeatmapMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (
      px < plot.left ||
      px > plot.left + plot.width ||
      py < plot.top ||
      py > plot.top + plot.height
    ) {
      return null;
    }
    const i = Math.round(invertAxis(meta.x, plot.left, plot.width, px, false));
    const j = Math.round(invertAxis(meta.y, plot.top, plot.height, py, true));
    const value = meta.cells[i]?.[j];
    if (value === undefined || value === null) return null;
    const a = dataToPx(meta, i - 0.5, j + 0.5);
    const b = dataToPx(meta, i + 0.5, j - 0.5);
    const start = meta.xStarts?.[i];
    const xValue =
      start !== undefined && meta.timeBin !== undefined
        ? `${formatValue(start, "time")} ~ ${formatValue(start + meta.timeBin, "time")}`
        : meta.xCategories[i];
    return {
      highlight: clipToPlot(meta, {
        x: a.px - HIGHLIGHT_PAD,
        y: a.py - HIGHLIGHT_PAD,
        width: b.px - a.px + HIGHLIGHT_PAD * 2,
        height: b.py - a.py + HIGHLIGHT_PAD * 2,
      }),
      rows: [
        { label: meta.xTitle, value: xValue },
        { label: meta.yTitle, value: meta.yCategories[j] },
        {
          label: AGG_LABELS[meta.agg],
          value: formatValue(value, "number"),
          emphasis: true,
        },
      ],
    };
  },
};

/** treemap: 커서 아래 잎의 이름·값·비율. 하이라이트는 잎 사각형이다. */
export const treemapStrategy: TooltipStrategy<TreemapMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (
      px < plot.left ||
      px > plot.left + plot.width ||
      py < plot.top ||
      py > plot.top + plot.height
    ) {
      return null;
    }
    const x = invertAxis(meta.x, plot.left, plot.width, px, false);
    const y = invertAxis(meta.y, plot.top, plot.height, py, true);
    const leaf = meta.leaves.find(
      (r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1,
    );
    if (!leaf) return null;
    const a = dataToPx(meta, leaf.x0, leaf.y1);
    const b = dataToPx(meta, leaf.x1, leaf.y0);
    const percent = (v: number, of: number) =>
      of > 0 ? `${((v / of) * 100).toFixed(1)}%` : "—";
    const rows: TooltipRow[] = [{ label: "이름", value: leaf.name }];
    const parent = meta.legend
      ? meta.parents.find((p) => p.g === leaf.g)
      : undefined;
    if (meta.legend && parent) {
      rows.push({
        label: meta.legend.title,
        value: meta.legend.values[leaf.g],
      });
    }
    rows.push(
      {
        label: AGG_LABELS[meta.agg],
        value: formatValue(leaf.value, "number"),
        emphasis: true,
      },
      { label: "비율", value: percent(leaf.value, meta.total), emphasis: true },
    );
    if (parent) {
      rows.push({
        label: "묶음 안 비율",
        value: percent(leaf.value, parent.value),
      });
    }
    return {
      highlight: clipToPlot(meta, {
        x: a.px - 1,
        y: a.py - 1,
        width: b.px - a.px + 2,
        height: b.py - a.py + 2,
      }),
      rows,
    };
  },
};

const STRATEGIES: {
  scatter: TooltipStrategy<ScatterMeta>;
  bar: TooltipStrategy<CategoryMeta>;
  boxplot: TooltipStrategy<CategoryMeta>;
  line: TooltipStrategy<ScatterMeta>;
  sankey: TooltipStrategy<SankeyMeta>;
  heatmap: TooltipStrategy<HeatmapMeta>;
  treemap: TooltipStrategy<TreemapMeta>;
} = {
  scatter: scatterStrategy,
  bar: barStrategy,
  boxplot: boxplotStrategy,
  // 행 단위 점이 scatter와 같아 가장 가까운 점을 그대로 찾는다.
  line: scatterStrategy,
  sankey: sankeyStrategy,
  heatmap: heatmapStrategy,
  treemap: treemapStrategy,
};

export function strategyFor<M extends ItemMeta>(meta: M) {
  return STRATEGIES[meta.chartType] as unknown as TooltipStrategy<M>;
}
