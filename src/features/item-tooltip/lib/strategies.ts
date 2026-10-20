// 차트 종류별 툴팁 전략. 각 전략은 metadata만으로 커서 위치를 해석하고(hitTest),
// 툴팁에 보여줄 줄(rows)을 만든다. 서버 호출이 필요한 추가 컬럼은 rowId로 넘긴다.

import type {
  AxisMeta,
  CategoryMeta,
  ItemMeta,
  ScatterMeta,
} from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import { formatValue } from "@/shared/lib/format";
import { groupSlot } from "./group-slot";
import { PointIndex } from "./point-index";

export type TooltipRow = { label: string; value: string; emphasis?: boolean };

export type TooltipHit = {
  /** 점 하이라이트 위치 (PNG 좌표). scatter */
  marker?: { px: number; py: number };
  /** 가리킨 막대/상자를 감싸는 사각형 (PNG 좌표). bar, boxplot */
  highlight?: { x: number; y: number; width: number; height: number };
  rows: TooltipRow[];
  /** 추가 컬럼을 서버에서 가져올 행. 없으면 서버 호출을 하지 않는다. */
  rowId?: number;
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

  hitTest(meta, prepared, px, py) {
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

const STRATEGIES: {
  scatter: TooltipStrategy<ScatterMeta>;
  bar: TooltipStrategy<CategoryMeta>;
  boxplot: TooltipStrategy<CategoryMeta>;
} = {
  scatter: scatterStrategy,
  bar: barStrategy,
  boxplot: boxplotStrategy,
};

export function strategyFor<M extends ItemMeta>(meta: M) {
  return STRATEGIES[meta.chartType] as unknown as TooltipStrategy<M>;
}
