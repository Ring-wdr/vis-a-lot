// 차트 종류별 툴팁 전략. 각 전략은 metadata만으로 커서 위치를 해석하고(hitTest),
// 툴팁에 보여줄 줄(rows)을 만든다. 서버 호출이 필요한 추가 컬럼은 rowId로 넘긴다.

import type { AxisMeta, ItemMeta, ScatterMeta } from "@/server/api/types";
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

const STRATEGIES: {
  [K in ItemMeta["chartType"]]: TooltipStrategy<
    Extract<ItemMeta, { chartType: K }>
  >;
} = {
  scatter: scatterStrategy,
};

export function strategyFor<M extends ItemMeta>(meta: M) {
  return STRATEGIES[
    meta.chartType as M["chartType"]
  ] as unknown as TooltipStrategy<M>;
}
