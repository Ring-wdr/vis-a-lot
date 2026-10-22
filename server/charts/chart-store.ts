// 서버 쪽 차트 상태. 이후 단계에서 PGlite에 영속화해 history의 원천이 된다.

import type {
  ChartImage,
  ChartSpec,
  Favorite,
  HistoryEvent,
  ItemMeta,
  ItemProps,
  ItemRestore,
  ItemSize,
  LegendGroup,
} from "../api/types";
import type { CandleData } from "../data/candle-data";
import type { CategoryData } from "../data/category-data";
import type { ChartData } from "../data/chart-data";
import type { HeatmapData } from "../data/heatmap-data";
import type { SankeyData } from "../data/sankey-data";
import type { Region } from "../render/region";
import type { ItemView } from "../render/scatter";
import type { Shape } from "../render/shapes";
import type { SpecColumn } from "./validate-spec";

export type ChartItem = {
  key: string;
  label: string;
  values: string[];
  /** 다시 그릴 때마다 올라간다. PNG URL의 v 파라미터가 된다. */
  version: number;
  /**
   * 그림 내용(확대 범위, 도형, 색)이 바뀔 때마다 올라간다. 크기만 바뀌는 resize에서는 그대로다.
   * 섬네일과 상세 PNG는 이 값이 같으면 다시 그리지 않는다.
   */
  revision: number;
  image?: ChartImage;
  meta?: ItemMeta;
  /** 고정 크기 섬네일. 내용이 바뀔 때만 다시 그린다. */
  thumbnail?: ChartImage;
  /** 크게 보기용 PNG. 현재 revision에서 그린 크기별로 둔다 ("WxH" → 결과). */
  details: Map<string, ItemDetail>;
  /** 크기별로 진행 중인 상세 렌더 job. 같은 요청이 겹치면 이 job을 같이 기다린다. */
  detailJobs: Map<string, string>;
  /** 확대한 데이터 범위. 없으면 전체 범위 */
  view?: ItemView;
  /** 확대하지 않았을 때의 범위. 축소가 전체 범위를 넘으면 초기화로 본다. */
  fullView?: ItemView;
  /** 데이터 좌표로 저장한 도형. 그린 순서대로 쌓이고 undo는 마지막 것을 뺀다. */
  shapes: Shape[];
  /** 선택 영역. 바깥 점은 흐리게 그리고, 데이터 다운로드·표는 이 영역 안 행만 쓴다. */
  selection?: Region;
  /** 마지막으로 그린 선택 영역 안의 점(막대/상자) 수 */
  selectedCount?: number;
  /** 이름 붙여 남긴 선택 영역 */
  favorites: Favorite[];
  /** 선택 영역으로 만든 새 범례. 순서대로 legend 끝에 붙는다. */
  legendGroups: LegendGroup[];
  /** 지운 영역 (scatter). 그린 순서대로 쌓이고 되돌리기는 마지막 것을 뺀다. */
  deletions: Region[];
  /** 개별 속성. split 조합 키에 붙어 있어 다시 불러와도 유지된다. 없으면 공통 속성을 따른다. */
  props?: ItemProps;
  /** item 단위 다시 그리기가 진행 중이면 그 job id */
  busyJobId?: string;
};

export type ItemDetail = { image: ChartImage; meta: ItemMeta };

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
  | ({ kind: "sankey" } & SankeyData)
  | ({ kind: "heatmap" } & HeatmapData)
  | ({ kind: "candle" } & CandleData)
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

/** 섬네일 크기. 브라우저 크기와 상관없이 고정이라 resize에 다시 그리지 않는다. */
export const THUMBNAIL_SIZE = { width: 128, height: 80 } as const;

/** item 하나에 남겨 둘 상세 PNG 크기 수. 넘치면 가장 오래 안 쓴 크기부터 지운다. */
const DETAIL_SIZES_PER_ITEM = 4;

const itemPath = (chartId: string, item: ChartItem) =>
  `/api/chart/charts/${encodeURIComponent(chartId)}/items/${encodeURIComponent(item.key)}/png`;

export function pngUrl(chartId: string, item: ChartItem) {
  return `${itemPath(chartId, item)}?v=${item.version}`;
}

export function thumbnailUrl(chartId: string, item: ChartItem) {
  return `${itemPath(chartId, item)}?r=${item.revision}&size=thumb`;
}

export const sizeKeyOf = (size: ItemSize) => `${size.width}x${size.height}`;

export function detailUrl(chartId: string, item: ChartItem, size: ItemSize) {
  return `${itemPath(chartId, item)}?r=${item.revision}&size=${sizeKeyOf(size)}`;
}

/** 쓴 크기를 뒤로 보내 LRU로 유지한다. */
export function getDetail(item: ChartItem, size: ItemSize) {
  const key = sizeKeyOf(size);
  const detail = item.details.get(key);
  if (detail) {
    item.details.delete(key);
    item.details.set(key, detail);
  }
  return detail;
}

/** 상세 PNG를 넣고, 밀려난 크기의 URL을 돌려준다 (PNG 저장소에서 지운다). */
export function putDetail(item: ChartItem, size: ItemSize, detail: ItemDetail) {
  item.details.set(sizeKeyOf(size), detail);
  const evicted: string[] = [];
  while (item.details.size > DETAIL_SIZES_PER_ITEM) {
    const [oldest, { image }] = item.details.entries().next().value as [
      string,
      ItemDetail,
    ];
    item.details.delete(oldest);
    evicted.push(image.url);
  }
  return evicted;
}

/** 내용이 바뀌면 revision을 올리고, 예전 내용으로 그린 상세 PNG URL을 돌려준다. */
export function bumpRevision(item: ChartItem) {
  item.revision++;
  const stale = [...item.details.values()].map((d) => d.image.url);
  item.details.clear();
  return stale;
}
