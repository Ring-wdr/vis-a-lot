// 서버 쪽 차트 상태. 이후 단계에서 PGlite에 영속화해 history의 원천이 된다.

import type { ChartImage, ChartSpec, ItemSize } from "../api/types";
import type { ScatterMeta } from "../render/scatter";

export type ChartItem = {
  key: string;
  label: string;
  values: string[];
  /** 다시 그릴 때마다 올라간다. PNG URL의 v 파라미터가 된다. */
  version: number;
  image?: ChartImage;
  meta?: ScatterMeta;
};

export type ChartRecord = {
  id: string;
  spec: ChartSpec;
  itemSize: ItemSize;
  /** 데이터 조회가 끝나야 정해진다. */
  items: ChartItem[] | null;
  createdAt: number;
};

const charts = new Map<string, ChartRecord>();

export function createChart(spec: ChartSpec, itemSize: ItemSize): ChartRecord {
  const chart: ChartRecord = {
    id: crypto.randomUUID(),
    spec,
    itemSize,
    items: null,
    createdAt: Date.now(),
  };
  charts.set(chart.id, chart);
  return chart;
}

export function getChart(id: string) {
  return charts.get(id);
}

export function pngUrl(chartId: string, item: ChartItem) {
  return `/api/charts/${encodeURIComponent(chartId)}/items/${encodeURIComponent(item.key)}/png?v=${item.version}`;
}
