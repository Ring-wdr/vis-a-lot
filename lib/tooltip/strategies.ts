// 차트 종류별 툴팁 전략. 각 전략은 metadata만으로 커서 위치를 해석하고(hitTest),
// 툴팁에 보여줄 줄(rows)을 만든다. 서버 호출이 필요한 추가 컬럼은 rowId로 넘긴다.

import type {
  AxisMeta,
  CategoryMeta,
  ItemMeta,
  ScatterMeta,
} from "@/server/api/types";
import { AGG_LABELS } from "@/server/data/schema";
import { formatValue } from "./format";
import { PointIndex } from "./point-index";

export type TooltipRow = { label: string; value: string; emphasis?: boolean };

export type TooltipHit = {
  /** 하이라이트할 위치 (PNG 좌표) */
  marker?: { px: number; py: number };
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
    return {
      marker: { px: points.px[index], py: points.py[index] },
      rows,
      rowId: points.id[index],
    };
  },
};

/** 범주 인덱스 축에서 커서가 가리키는 막대/상자. 표식 너비 안에 있을 때만 맞힌 것으로 본다. */
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
  return { index, center };
}

function yToPx(meta: CategoryMeta, v: number) {
  const { plot } = meta;
  const [d0, d1] = meta.y.domain;
  return plot.top + plot.height - ((v - d0) / (d1 - d0)) * plot.height;
}

const HIT_SLOP_PX = 3;

export const barStrategy: TooltipStrategy<CategoryMeta> = {
  prepare: () => undefined,
  hitTest(meta, _prepared, px, py) {
    const hit = hitCategory(meta, px, py);
    const value = hit && meta.bars?.[hit.index];
    if (!hit || value === undefined) return null;
    return {
      marker: { px: hit.center, py: yToPx(meta, value) },
      rows: [
        { label: "범주", value: meta.categories[hit.index] },
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
    const hit = hitCategory(meta, px, py);
    const box = hit && meta.boxes?.[hit.index];
    if (!hit || !box) return null;
    const num = (v: number) => formatValue(v, "number");
    return {
      marker: { px: hit.center, py: yToPx(meta, box.median) },
      rows: [
        { label: "범주", value: meta.categories[hit.index] },
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
