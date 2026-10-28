// 차트 종류별 툴팁 전략. 각 전략은 metadata만으로 커서 위치를 해석하고(hitTest),
// 툴팁에 보여줄 줄(rows)을 만든다. 서버 호출이 필요한 추가 컬럼은 rowId로 넘긴다.

import { invertAxis } from "@/entities/chart/lib/coords";
import type {
  CandleMeta,
  CategoryMeta,
  FunnelMeta,
  GanttMeta,
  HeatmapMeta,
  HistogramMeta,
  ItemMeta,
  PieMeta,
  RadarMeta,
  SankeyMeta,
  ScatterMeta,
  TreemapMeta,
  WaterfallMeta,
} from "@/shared/api/types";
import { aggLabel } from "@/shared/config/dataset";
import { formatValue } from "@/shared/lib/format";
import { defineMessages, intlLocale, t } from "@/shared/lib/i18n";
import { groupSlot } from "./group-slot";
import { PointIndex } from "./point-index";
import { hitSankey, linkOutline } from "./sankey-hit";

const messages = defineMessages({
  ko: {
    cursorX: "커서 x",
    cursorY: "커서 y",
    nearestX: "가까운 점 x",
    nearestY: "가까운 점 y",
    category: "범주",
    ratio: "비율",
    count: "개수",
    whiskerHigh: "최댓값(수염)",
    median: "중앙값",
    whiskerLow: "최솟값(수염)",
    mean: "평균",
    outliers: "이상치",
    source: "출발",
    target: "도착",
    inflow: "들어오는 합",
    outflow: "나가는 합",
    name: "이름",
    groupRatio: "묶음 안 비율",
    range: "구간",
    open: "시가",
    high: "고가",
    low: "저가",
    close: "종가",
    start: "시작",
    end: "끝",
    duration: "길이",
    merged: "합친 구간",
    child: "나눈 값",
    cumulative: "누적",
    stage: "단계",
    prevRate: "이전 단계 대비",
    firstRate: "첫 단계 대비",
    value: "값",
    sourceNode: "출발 노드",
    targetNode: "도착 노드",
    slice: "조각",
    sliceRatio: "조각 안 비율",
    series: "계열",
    total: "합계",
    items: (n: string) => `${n}개`,
    /** 구간 [from, to) */
    openRange: (from: string, to: string) => `${from} ~ ${to} 미만`,
    /** 마지막 구간 [from, to] */
    closedRange: (from: string, to: string) => `${from} ~ ${to}`,
    day: "일",
    hour: "시간",
    minute: "분",
    second: "초",
  },
  en: {
    cursorX: "cursor x",
    cursorY: "cursor y",
    nearestX: "nearest x",
    nearestY: "nearest y",
    category: "Category",
    ratio: "Ratio",
    count: "Count",
    whiskerHigh: "Max (whisker)",
    median: "Median",
    whiskerLow: "Min (whisker)",
    mean: "Mean",
    outliers: "Outliers",
    source: "From",
    target: "To",
    inflow: "Inflow",
    outflow: "Outflow",
    name: "Name",
    groupRatio: "Ratio in group",
    range: "Range",
    open: "Open",
    high: "High",
    low: "Low",
    close: "Close",
    start: "Start",
    end: "End",
    duration: "Duration",
    merged: "Merged",
    child: "Subdivision",
    cumulative: "Cumulative",
    stage: "Stage",
    prevRate: "vs. previous",
    firstRate: "vs. first",
    value: "Value",
    sourceNode: "Source node",
    targetNode: "Target node",
    slice: "Slice",
    sliceRatio: "Ratio in slice",
    series: "Series",
    total: "Total",
    items: (n: string) => n,
    openRange: (from: string, to: string) => `${from} ~ <${to}`,
    closedRange: (from: string, to: string) => `${from} ~ ${to}`,
    day: "d",
    hour: "h",
    minute: "m",
    second: "s",
  },
});

/** 지금 언어의 툴팁 문구. 툴팁을 그리는 컴포넌트가 언어 변경을 구독한다. */
const msg = () => t(messages);

/** 툴팁 한 줄. id는 그 차트 툴팁 안에서 줄의 역할(커서 x, 합계 등)이라 label이 겹쳐도 줄을 구분한다. */
export type TooltipRow = {
  id: string;
  label: string;
  value: string;
  emphasis?: boolean;
};

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
      {
        id: "cursorX",
        label: msg().cursorX,
        value: formatValue(x, meta.x.kind),
      },
      {
        id: "cursorY",
        label: msg().cursorY,
        value: formatValue(y, meta.y.kind),
      },
    ];
    // 가까운 점을 끄면 tooltip 컬럼도 가져오지 않는다 (가까운 점의 행에서 읽는 값이다).
    if (!nearest) return { rows };
    const index = (prepared as PointIndex).nearest(px, py, NEAREST_MAX_PX);
    if (index === -1) return { rows };
    const { points } = meta;
    rows.push(
      {
        id: "nearestX",
        label: msg().nearestX,
        value: formatValue(points.x[index], meta.x.kind),
        emphasis: true,
      },
      {
        id: "nearestY",
        label: msg().nearestY,
        value: formatValue(points.y[index], meta.y.kind),
        emphasis: true,
      },
    );
    const g = points.g?.[index];
    if (meta.legend && g !== undefined) {
      rows.push({
        id: "legend",
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
  // 누적 막대: 범주 하나에 한 줄로 쌓여 있어 커서 높이로 어느 막대인지 찾는다.
  if (meta.segments) {
    const row = meta.segments[index] ?? [];
    const g = row.findIndex((seg) => {
      if (!seg) return false;
      const a = yToPx(meta, seg[0]);
      const b = yToPx(meta, seg[1]);
      return py >= Math.min(a, b) - 1 && py <= Math.max(a, b) + 1;
    });
    if (g < 0) return undefined;
    const { cx, width } = groupSlot(center, meta.markWidth, 1, 0, 0);
    return { index, g, cx, width };
  }
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

function yToPx(meta: ItemMeta, v: number) {
  const { plot } = meta;
  const [d0, d1] = meta.y.domain;
  return plot.top + plot.height - ((v - d0) / (d1 - d0)) * plot.height;
}

/** 범주 줄과, legend가 있으면 legend 값 줄 */
function categoryRows(meta: CategoryMeta, index: number, g: number) {
  const rows: TooltipRow[] = [
    { id: "category", label: msg().category, value: meta.categories[index] },
  ];
  if (meta.legend) {
    rows.push({
      id: "legend",
      label: meta.legend.title,
      value: meta.legend.values[g],
    });
  }
  return rows;
}

const HIT_SLOP_PX = 3;
const HIGHLIGHT_PAD = 3;

/** 막대/상자의 세로 범위(데이터 값)를 감싸는 사각형. 그림 영역 밖으로는 나가지 않는다. */
function highlightRect(
  meta: ItemMeta,
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
    const seg = meta.segments?.[hit.index]?.[hit.g];
    return {
      highlight: highlightRect(
        meta,
        hit.cx,
        hit.width,
        seg ? seg[0] : 0,
        seg ? seg[1] : value,
      ),
      rows: [
        ...categoryRows(meta, hit.index, hit.g),
        {
          id: "value",
          label: meta.agg ? aggLabel(meta.agg) : msg().value,
          value: formatValue(value, "number"),
          emphasis: meta.stack !== "stack100",
        },
        ...(seg && meta.stack === "stack100"
          ? [
              {
                id: "ratio",
                label: msg().ratio,
                value: `${(seg[1] - seg[0]).toFixed(1)}%`,
                emphasis: true,
              },
            ]
          : []),
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
        { id: "count", label: msg().count, value: num(box.n) },
        { id: "whiskerHigh", label: msg().whiskerHigh, value: num(box.hi) },
        { id: "q3", label: "Q3", value: num(box.q3) },
        {
          id: "median",
          label: msg().median,
          value: num(box.median),
          emphasis: true,
        },
        { id: "q1", label: "Q1", value: num(box.q1) },
        { id: "whiskerLow", label: msg().whiskerLow, value: num(box.lo) },
        { id: "mean", label: msg().mean, value: num(box.mean) },
        {
          id: "outliers",
          label: msg().outliers,
          value: msg().items(num(box.outlierCount)),
        },
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
    const valueLabel = aggLabel(meta.agg);
    if (hit.kind === "link") {
      const link = meta.links[hit.index];
      return {
        outline: linkOutline(meta, link),
        rows: [
          {
            id: "source",
            label: msg().source,
            value: meta.nodes[link.source].name,
          },
          {
            id: "target",
            label: msg().target,
            value: meta.nodes[link.target].name,
          },
          {
            id: "value",
            label: valueLabel,
            value: num(link.value),
            emphasis: true,
          },
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
          id: "node",
          label: node.side === "source" ? msg().sourceNode : msg().targetNode,
          value: node.name,
        },
        {
          id: "inflow",
          label: msg().inflow,
          value: num(node.in),
          emphasis: node.side === "target",
        },
        {
          id: "outflow",
          label: msg().outflow,
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
        { id: "x", label: meta.xTitle, value: xValue },
        { id: "y", label: meta.yTitle, value: meta.yCategories[j] },
        {
          id: "value",
          label: aggLabel(meta.agg),
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
    const rows: TooltipRow[] = [
      { id: "name", label: msg().name, value: leaf.name },
    ];
    const parent = meta.legend
      ? meta.parents.find((p) => p.g === leaf.g)
      : undefined;
    if (meta.legend && parent) {
      rows.push({
        id: "legend",
        label: meta.legend.title,
        value: meta.legend.values[leaf.g],
      });
    }
    rows.push(
      {
        id: "value",
        label: aggLabel(meta.agg),
        value: formatValue(leaf.value, "number"),
        emphasis: true,
      },
      {
        id: "ratio",
        label: msg().ratio,
        value: percent(leaf.value, meta.total),
        emphasis: true,
      },
    );
    if (parent) {
      rows.push({
        id: "groupRatio",
        label: msg().groupRatio,
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

/** 시각 x가 든 캔들 인덱스. 구간 시작(t) 오름차순에서 이진 탐색한다. 없으면 -1 */
export function candleAt(t: readonly number[], interval: number, x: number) {
  let lo = 0;
  let hi = t.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= x) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found !== -1 && x < t[found] + interval ? found : -1;
}

export const candleStrategy: TooltipStrategy<CandleMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot, candles, interval } = meta;
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
    const i = candleAt(candles.t, interval, x);
    if (i === -1) return null;
    const [d0, d1] = meta.x.domain;
    const cx =
      plot.left + ((candles.t[i] + interval / 2 - d0) / (d1 - d0)) * plot.width;
    const num = (v: number) => formatValue(v, "number");
    const g = candles.g[i];
    return {
      highlight: highlightRect(
        meta,
        cx,
        meta.bodyWidth,
        candles.low[i],
        candles.high[i],
      ),
      rows: [
        {
          id: "range",
          label: msg().range,
          value: `${formatValue(candles.t[i], "time")} ~ ${formatValue(candles.t[i] + interval, "time")}`,
        },
        ...(meta.legend
          ? [
              {
                id: "legend",
                label: meta.legend.title,
                value: meta.legend.values[g],
              },
            ]
          : []),
        { id: "open", label: msg().open, value: num(candles.open[i]) },
        { id: "high", label: msg().high, value: num(candles.high[i]) },
        { id: "low", label: msg().low, value: num(candles.low[i]) },
        {
          id: "close",
          label: msg().close,
          value: num(candles.close[i]),
          emphasis: true,
        },
        { id: "count", label: msg().count, value: num(candles.count[i]) },
      ],
    };
  },
};

/** 기간을 '2시간 5분', '35초'처럼 가장 큰 단위와 그다음 단위로 */
export function formatDuration(ms: number) {
  const units: [number, string][] = [
    [86_400_000, msg().day],
    [3_600_000, msg().hour],
    [60_000, msg().minute],
    [1000, msg().second],
  ];
  const i = units.findIndex(([size]) => ms >= size);
  if (i === -1) return `${Math.round(ms)}ms`;
  const [size, name] = units[i];
  const head = `${Math.floor(ms / size)}${name}`;
  const next = units[i + 1];
  const rest = next && Math.floor((ms % size) / next[0]);
  return rest ? `${head} ${rest}${next[1]}` : head;
}

/** 행마다 막대 인덱스 범위 [시작, 끝). 막대는 행 → 시작 순으로 온다. */
export function ganttRowRanges(meta: GanttMeta) {
  const start = new Int32Array(meta.rows.length).fill(-1);
  const end = new Int32Array(meta.rows.length).fill(-1);
  meta.bars.r.forEach((r, j) => {
    if (start[r] === -1) start[r] = j;
    end[r] = j + 1;
  });
  return { start, end };
}

const GANTT_SLOP_PX = 2;

export const ganttStrategy: TooltipStrategy<GanttMeta> = {
  prepare: (meta) => ganttRowRanges(meta),
  hitTest(meta, prepared, px, py) {
    const { plot, bars, rows } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (
      px < plot.left ||
      px > plot.left + plot.width ||
      py < plot.top ||
      py > plot.top + plot.height
    ) {
      return null;
    }
    const yv = invertAxis(meta.y, plot.top, plot.height, py, true);
    const row = rows.length - 1 - Math.round(yv);
    if (row < 0 || row >= rows.length) return null;
    const cy = yToPx(meta, rows.length - 1 - row);
    if (Math.abs(py - cy) > meta.barHeight / 2 + GANTT_SLOP_PX) return null;
    const { start, end } = prepared as ReturnType<typeof ganttRowRanges>;
    if (start[row] === -1) return null;
    const [d0, d1] = meta.x.domain;
    const toPx = (v: number) => plot.left + ((v - d0) / (d1 - d0)) * plot.width;
    // 시작 순으로 놓여 있으니 커서 앞에서 시작한 마지막 막대를 찾는다.
    let lo = start[row];
    let hi = end[row] - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (toPx(bars.s[mid]) - GANTT_SLOP_PX <= px) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (found === -1) return null;
    const x0 = toPx(bars.s[found]);
    const x1 = Math.max(toPx(bars.e[found]), x0 + 1);
    if (px > x1 + GANTT_SLOP_PX) return null;
    const left = Math.max(plot.left, x0);
    const right = Math.min(plot.left + plot.width, x1);
    const g = bars.g[found];
    const merged = bars.m[found];
    return {
      highlight: {
        x: left - HIGHLIGHT_PAD,
        y: cy - meta.barHeight / 2 - HIGHLIGHT_PAD,
        width: right - left + HIGHLIGHT_PAD * 2,
        height: meta.barHeight + HIGHLIGHT_PAD * 2,
      },
      rows: [
        { id: "row", label: meta.rowTitle, value: rows[row] },
        ...(meta.legend
          ? [
              {
                id: "legend",
                label: meta.legend.title,
                value: meta.legend.values[g],
              },
            ]
          : []),
        {
          id: "start",
          label: msg().start,
          value: formatValue(bars.s[found], "time"),
        },
        {
          id: "end",
          label: msg().end,
          value: formatValue(bars.e[found], "time"),
        },
        {
          id: "duration",
          label: msg().duration,
          value: formatDuration(bars.e[found] - bars.s[found]),
          emphasis: true,
        },
        {
          id: "count",
          label: msg().count,
          value: formatValue(bars.n[found], "number"),
        },
        ...(merged > 1
          ? [
              {
                id: "merged",
                label: msg().merged,
                value: msg().items(merged.toLocaleString(intlLocale())),
              },
            ]
          : []),
      ],
    };
  },
};

type PieChild = NonNullable<PieMeta["children"]>[number];

/**
 * 커서가 가리키는 pie 조각. 원(고리) 밖이면 undefined.
 * pie3d는 눕힌 타원이라 세로를 펴서 원으로 보고, doughnut·sunburst의 가운데 빈 곳은 조각이 아니다.
 * sunburst 바깥 고리면 child에 그 몫을 함께 준다.
 */
export function hitSlice(
  meta: PieMeta,
  px: number,
  py: number,
): (PieMeta["slices"][number] & { child?: PieChild }) | undefined {
  const k = meta.radiusY ? meta.radiusY / meta.radius : 1;
  const dx = px - meta.center.x;
  const dy = (py - meta.center.y) / k;
  const d2 = dx * dx + dy * dy;
  if (d2 > meta.radius * meta.radius) return undefined;
  const inner = meta.innerRadius ?? 0;
  if (d2 < inner * inner) return undefined;
  // 조각 각도는 12시(-π/2)에서 시작해 3π/2까지라 그 범위로 맞춘다.
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  const within = (s: { start: number; end: number }) =>
    angle >= s.start && angle <= s.end;
  if (meta.ring !== undefined && d2 > meta.ring * meta.ring) {
    const child = meta.children?.find(within);
    const slice = child && meta.slices.find((s) => s.category === child.parent);
    return slice && { ...slice, child };
  }
  return meta.slices.find(within);
}

/**
 * 부채꼴 SVG path. inner > 0이면 고리 조각, k < 1이면 세로로 눕힌 타원(pie3d).
 * 한 바퀴 전체면 반쪽 호 둘로 그린다 (시작점과 끝점이 같으면 호가 사라진다).
 */
export function wedgePath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  inner = 0,
  k = 1,
) {
  const at = (a: number, rr: number) =>
    `${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr * k}`;
  const arc = (rr: number, from: number, to: number, sweep: 0 | 1) => {
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `A ${rr} ${rr * k} 0 ${large} ${sweep} ${at(to, rr)}`;
  };
  if (end - start >= Math.PI * 2 - 1e-9) {
    const mid = start + Math.PI;
    const outer = `M ${at(start, r)} ${arc(r, start, mid, 1)} ${arc(r, mid, start, 1)} Z`;
    if (inner <= 0) return outer;
    return `${outer} M ${at(start, inner)} ${arc(inner, start, mid, 0)} ${arc(inner, mid, start, 0)} Z`;
  }
  if (inner <= 0) {
    return `M ${cx} ${cy} L ${at(start, r)} ${arc(r, start, end, 1)} Z`;
  }
  return `M ${at(start, r)} ${arc(r, start, end, 1)} L ${at(end, inner)} ${arc(inner, end, start, 0)} Z`;
}

const OUTLINE_PAD = 3;

export const pieStrategy: TooltipStrategy<PieMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    if (inLegendBox(meta, px, py)) return null;
    const slice = hitSlice(meta, px, py);
    if (!slice) return null;
    const k = meta.radiusY ? meta.radiusY / meta.radius : 1;
    const { child } = slice;
    // sunburst 바깥 고리면 그 몫만, 아니면 조각(안쪽 고리) 둘레를 그린다.
    const outer = child
      ? meta.radius + OUTLINE_PAD
      : (meta.ring ?? meta.radius) + OUTLINE_PAD;
    const inner = child
      ? (meta.ring ?? 0)
      : Math.max(0, (meta.innerRadius ?? 0) - OUTLINE_PAD);
    return {
      outline: wedgePath(
        meta.center.x,
        meta.center.y,
        outer,
        (child ?? slice).start,
        (child ?? slice).end,
        inner,
        k,
      ),
      rows: [
        {
          id: "slice",
          label: meta.legend?.title ?? msg().slice,
          value: slice.category,
        },
        ...(child
          ? [{ id: "child", label: msg().child, value: child.category }]
          : []),
        {
          id: "value",
          label: meta.agg ? aggLabel(meta.agg) : msg().value,
          value: formatValue((child ?? slice).value, "number"),
        },
        {
          id: "ratio",
          label: child ? msg().sliceRatio : msg().ratio,
          value: `${((child ?? slice).ratio * 100).toFixed(1)}%`,
          emphasis: true,
        },
      ],
    };
  },
};

/** 커서에서 가장 가까운 radar 꼭짓점 [계열 순번, 축 순번]. NEAREST_MAX_PX 안에 없으면 undefined */
export function nearestVertex(meta: RadarMeta, px: number, py: number) {
  let best: [number, number] | undefined;
  let bestD = NEAREST_MAX_PX * NEAREST_MAX_PX;
  meta.series.forEach((s, k) => {
    s.points.forEach((p, i) => {
      if (!p) return;
      const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = [k, i];
      }
    });
  });
  return best;
}

export const radarStrategy: TooltipStrategy<RadarMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    if (inLegendBox(meta, px, py)) return null;
    const hit = nearestVertex(meta, px, py);
    if (!hit) return null;
    const [k, i] = hit;
    const series = meta.series[k];
    const point = series.points[i] as [number, number];
    return {
      marker: { px: point[0], py: point[1] },
      rows: [
        { id: "axis", label: meta.axisTitle, value: meta.axes[i] },
        {
          id: "series",
          label: meta.legend?.title ?? msg().series,
          value: series.name,
        },
        {
          id: "value",
          label: meta.agg ? aggLabel(meta.agg) : msg().value,
          value: formatValue(series.values[i], "number"),
          emphasis: true,
        },
      ],
    };
  },
};

/** 데이터 x 값 → PNG x 좌표 */
function xToPx(meta: ItemMeta, v: number) {
  const { plot } = meta;
  const [d0, d1] = meta.x.domain;
  return plot.left + ((v - d0) / (d1 - d0)) * plot.width;
}

/** legend 체크박스로 끈 값인지 */
function legendHidden(meta: ItemMeta, index: number) {
  return meta.legend?.entries.find((e) => e.index === index)?.visible === false;
}

/** 커서가 가리키는 구간과, legend가 있으면 그 구간 안의 막대 칸 */
export const histogramStrategy: TooltipStrategy<HistogramMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot, bins } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (
      px < plot.left ||
      px > plot.left + plot.width ||
      py < plot.top ||
      py > plot.top + plot.height
    ) {
      return null;
    }
    const v = invertAxis(meta.x, plot.left, plot.width, px, false);
    const pos = (v - bins.lo) / bins.step;
    const i = Math.min(bins.count - 1, Math.floor(pos));
    if (pos < 0 || pos > bins.count) return null;
    const g = Math.min(
      meta.groupCount - 1,
      Math.max(0, Math.floor((pos - i) * meta.groupCount)),
    );
    if (legendHidden(meta, g)) return null;
    const count = meta.counts[i]?.[g] ?? 0;
    const from = bins.lo + bins.step * i;
    const to = from + bins.step;
    const num = (n: number) => formatValue(n, "number");
    // 마지막 구간만 끝값을 포함한다.
    const range =
      i === bins.count - 1
        ? msg().closedRange(num(from), num(to))
        : msg().openRange(num(from), num(to));
    const left = xToPx(meta, from + (bins.step * g) / meta.groupCount);
    const right = xToPx(meta, from + (bins.step * (g + 1)) / meta.groupCount);
    const rows: TooltipRow[] = [
      { id: "range", label: msg().range, value: range },
    ];
    if (meta.legend)
      rows.push({
        id: "legend",
        label: meta.legend.title,
        value: meta.legend.values[g],
      });
    rows.push({
      id: "count",
      label: msg().count,
      value: num(count),
      emphasis: true,
    });
    return {
      highlight: highlightRect(
        meta,
        (left + right) / 2,
        right - left,
        0,
        count,
      ),
      rows,
    };
  },
};

/** waterfall: 가리킨 막대의 범주·값·누적. 마지막 막대는 합계다. */
export const waterfallStrategy: TooltipStrategy<WaterfallMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot, steps } = meta;
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
    const step = steps[i];
    if (!step) return null;
    const center = xToPx(meta, i);
    if (Math.abs(px - center) > meta.markWidth / 2 + HIT_SLOP_PX) return null;
    if (legendHidden(meta, step.kind)) return null;
    const num = (n: number) => formatValue(n, "number");
    const label = meta.agg ? aggLabel(meta.agg) : msg().value;
    return {
      highlight: highlightRect(
        meta,
        center,
        meta.markWidth,
        step.start,
        step.end,
      ),
      rows:
        step.kind === 2
          ? [
              { id: "category", label: msg().category, value: msg().total },
              {
                id: "cumulative",
                label: msg().cumulative,
                value: num(step.end),
                emphasis: true,
              },
            ]
          : [
              {
                id: "category",
                label: msg().category,
                value: meta.categories[i],
              },
              {
                id: "change",
                label,
                value: num(step.end - step.start),
                emphasis: true,
              },
              {
                id: "cumulative",
                label: msg().cumulative,
                value: num(step.end),
              },
            ],
    };
  },
};

/** funnel: 가리킨 단계의 값과 전환율. 막대가 놓인 줄 높이 안이면 막대 옆 빈 곳도 그 단계로 본다. */
export const funnelStrategy: TooltipStrategy<FunnelMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const { plot } = meta;
    if (inLegendBox(meta, px, py)) return null;
    if (py < plot.top || py > plot.top + plot.height) return null;
    const stage = meta.stages.find(
      (s) =>
        py >= s.rect.y - HIT_SLOP_PX &&
        py <= s.rect.y + s.rect.height + HIT_SLOP_PX &&
        px >= Math.min(s.rect.x, plot.left) - HIT_SLOP_PX &&
        px <= plot.left + plot.width,
    );
    if (!stage) return null;
    const pct = (r: number | null) =>
      r === null
        ? "–"
        : `${(r * 100).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })}%`;
    const { rect } = stage;
    return {
      highlight: {
        x: rect.x - HIGHLIGHT_PAD,
        y: rect.y - HIGHLIGHT_PAD,
        width: rect.width + HIGHLIGHT_PAD * 2,
        height: rect.height + HIGHLIGHT_PAD * 2,
      },
      rows: [
        { id: "stage", label: msg().stage, value: stage.label },
        {
          id: "value",
          label: meta.agg ? aggLabel(meta.agg) : msg().value,
          value: formatValue(stage.value, "number"),
          emphasis: true,
        },
        { id: "prevRate", label: msg().prevRate, value: pct(stage.rate) },
        { id: "firstRate", label: msg().firstRate, value: pct(stage.share) },
      ],
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
  candle: TooltipStrategy<CandleMeta>;
  gantt: TooltipStrategy<GanttMeta>;
  pie: TooltipStrategy<PieMeta>;
  radar: TooltipStrategy<RadarMeta>;
  histogram: TooltipStrategy<HistogramMeta>;
  waterfall: TooltipStrategy<WaterfallMeta>;
  funnel: TooltipStrategy<FunnelMeta>;
} = {
  scatter: scatterStrategy,
  bar: barStrategy,
  boxplot: boxplotStrategy,
  // 행 단위 점이 scatter와 같아 가장 가까운 점을 그대로 찾는다.
  line: scatterStrategy,
  sankey: sankeyStrategy,
  heatmap: heatmapStrategy,
  treemap: treemapStrategy,
  candle: candleStrategy,
  gantt: ganttStrategy,
  pie: pieStrategy,
  radar: radarStrategy,
  histogram: histogramStrategy,
  waterfall: waterfallStrategy,
  funnel: funnelStrategy,
};

export function strategyFor<M extends ItemMeta>(meta: M) {
  return STRATEGIES[meta.chartType] as unknown as TooltipStrategy<M>;
}
