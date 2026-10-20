// 서버 쪽 차트 상태. 이후 단계에서 PGlite에 영속화해 history의 원천이 된다.

import type {
  ChartImage,
  ChartSpec,
  HistoryEvent,
  ItemMeta,
  ItemProps,
  ItemRestore,
  ItemSize,
} from "../api/types";
import type { CategoryData } from "../data/category-data";
import type { ChartData } from "../data/chart-data";
import type { ItemView } from "../render/scatter";
import type { Shape } from "../render/shapes";
import type { SpecColumn } from "./validate-spec";

export type ChartItem = {
  key: string;
  label: string;
  values: string[];
  /** 다시 그릴 때마다 올라간다. PNG URL의 v 파라미터가 된다. */
  version: number;
  image?: ChartImage;
  meta?: ItemMeta;
  /** 확대한 데이터 범위. 없으면 전체 범위 */
  view?: ItemView;
  /** 확대하지 않았을 때의 범위. 축소가 전체 범위를 넘으면 초기화로 본다. */
  fullView?: ItemView;
  /** 데이터 좌표로 저장한 도형. 그린 순서대로 쌓이고 undo는 마지막 것을 뺀다. */
  shapes: Shape[];
  /** 개별 속성. split 조합 키에 붙어 있어 다시 불러와도 유지된다. 없으면 공통 속성을 따른다. */
  props?: ItemProps;
  /** item 단위 다시 그리기가 진행 중이면 그 job id */
  busyJobId?: string;
};

export type ChartRecord = {
  id: string;
  spec: ChartSpec;
  itemSize: ItemSize;
  /** 데이터 조회가 끝나야 정해진다. */
  items: ChartItem[] | null;
  /** history 복원이나 공유 링크로 열었을 때, 조회 후 키별로 덮어쓸 item 상태 */
  restore?: Record<string, ItemRestore>;
  /** 이 차트가 기록 중인 history */
  history?: { id: string; createdAt: number; events: HistoryEvent[] };
  /** draw로 만든 job. item 단위 다시 그리기 결과도 이 job의 item 상태에 반영한다. */
  primaryJobId?: string;
  createdAt: number;
  /** 데이터가 준비된 뒤 받은 데이터셋 스키마. 축 종류와 legend 제목을 여기서 정한다. */
  columns?: SpecColumn[];
};

/** item 단위 다시 그리기에 재사용할 조회 결과. 최근 차트 몇 개만 메모리에 둔다. */
export type CachedChartData = (
  | ({ kind: "scatter" } & ChartData)
  | ({ kind: "category" } & CategoryData)
) & { groupOf: Map<string, number> };

const charts = new Map<string, ChartRecord>();
const dataCache = new Map<string, CachedChartData>();
const DATA_CACHE_SIZE = 3;

export function createChart(
  spec: ChartSpec,
  itemSize: ItemSize,
  restore?: Record<string, ItemRestore>,
): ChartRecord {
  const chart: ChartRecord = {
    id: crypto.randomUUID(),
    spec,
    itemSize,
    restore,
    items: null,
    createdAt: Date.now(),
  };
  charts.set(chart.id, chart);
  return chart;
}

export function getChart(id: string) {
  return charts.get(id);
}

export function getItem(chart: ChartRecord, key: string) {
  return chart.items?.find((i) => i.key === key);
}

export function cacheChartData(chartId: string, data: CachedChartData) {
  dataCache.delete(chartId);
  dataCache.set(chartId, data);
  while (dataCache.size > DATA_CACHE_SIZE) {
    const oldest = dataCache.keys().next().value as string;
    dataCache.delete(oldest);
  }
}

export function getCachedChartData(chartId: string) {
  const data = dataCache.get(chartId);
  if (data) {
    // 최근에 쓴 것을 뒤로 보내 LRU로 유지한다.
    dataCache.delete(chartId);
    dataCache.set(chartId, data);
  }
  return data;
}

export function pngUrl(chartId: string, item: ChartItem) {
  return `/api/chart/charts/${encodeURIComponent(chartId)}/items/${encodeURIComponent(item.key)}/png?v=${item.version}`;
}
