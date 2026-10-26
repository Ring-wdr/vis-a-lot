// Worker별 RPC 메서드 정의.

import type {
  CsvCheck,
  DatasetStatus,
  HistoryDetail,
  HistorySummary,
  Share,
  StagedUpload,
  UploadTask,
} from "./api/types";
import type { CandleData, CandleDataParams } from "./data/candle-data";
import type { CategoryData, CategoryDataParams } from "./data/category-data";
import type { ChartData, ChartDataParams } from "./data/chart-data";
import type { ColumnSummary } from "./data/column-summary";
import type { CsvOptions, CsvPreview } from "./data/csv-import";
import type { ColumnInfo } from "./data/datasets";
import type { ChartFilter } from "./data/filters";
import type { GanttData, GanttDataParams } from "./data/gantt-data";
import type { HeatmapData, HeatmapDataParams } from "./data/heatmap-data";
import type { HistogramData, HistogramDataParams } from "./data/histogram-data";
import type { ItemRowsPage, ItemRowsScope } from "./data/item-rows";
import type { PieData, RadarData } from "./data/polar-data";
import type { SampleRowsPage } from "./data/sample-rows";
import type { SankeyData, SankeyDataParams } from "./data/sankey-data";
import type { FeedReply, FeedRequest } from "./feed/runner";
import type { CandleInput, CandleMeta } from "./render/candle";
import type { CategoryInput, CategoryMeta } from "./render/category";
import type { FunnelInput, FunnelMeta } from "./render/funnel";
import type { GanttInput, GanttMeta } from "./render/gantt";
import type { HeatmapInput, HeatmapMeta } from "./render/heatmap";
import type { HistogramInput, HistogramMeta } from "./render/histogram";
import type { PieInput, PieMeta } from "./render/pie";
import type { RadarInput, RadarMeta } from "./render/radar";
import type { SankeyInput, SankeyMeta } from "./render/sankey";
import type { RenderStage, ScatterInput, ScatterMeta } from "./render/scatter";
import type { TreemapInput, TreemapMeta } from "./render/treemap";
import type { WaterfallInput, WaterfallMeta } from "./render/waterfall";
import type { StoredShare } from "./shares/share-store";

/** CSV 검사에서 거절된 이유는 에러가 아니라 결과로 돌려준다. */
export type Rejectable<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type DbMethods = {
  ping: {
    params: undefined;
    result: { version: string; bootCount: number; bootMs: number };
  };
  query: {
    params: { sql: string; params?: unknown[] };
    result: { rows: Record<string, unknown>[] };
  };
  datasetStatuses: { params: undefined; result: DatasetStatus[] };
  /** 모르는 데이터셋이면 null */
  datasetStatus: { params: { id: string }; result: DatasetStatus | null };
  /** 샘플이 없으면 생성을 시작하고 바로 현재 상태를 돌려준다. 적재는 한 번에 하나씩 순서대로 한다. */
  ensureDataset: { params: { id: string }; result: DatasetStatus | null };
  /** CSV·zip을 올려 둔다. 거절 사유는 error로 돌려준다. */
  stageUpload: {
    params: { fileName: string; bytes: ArrayBuffer };
    result: Rejectable<StagedUpload>;
  };
  /** 업로드한 데이터셋의 원본을 다시 올려 둔다(수정). 모르는 데이터셋이면 null */
  stageDataset: {
    params: { id: string };
    result: Rejectable<StagedUpload> | null;
  };
  discardStage: { params: { stageId: string }; result: undefined };
  /** 올려 둔 파일 하나의 앞부분 미리보기 */
  previewUpload: {
    params: { stageId: string; file: number; options: CsvOptions };
    result: Rejectable<CsvPreview>;
  };
  /** 적재하지 않고 전체를 검사한다. */
  checkUpload: {
    params: { stageId: string; options: CsvOptions };
    result: Rejectable<CsvCheck>;
  };
  /** 적재를 시작한다. 진행은 uploadTask로 받는다. */
  commitUpload: {
    params: { stageId: string; name: string; options: CsvOptions };
    result: Rejectable<UploadTask>;
  };
  /** 업로드 진행. since 버전과 같으면 바뀔 때까지 기다린다. 모르는 stageId면 null */
  uploadTask: {
    params: { stageId: string; since?: number };
    result: UploadTask | null;
  };
  renameDataset: {
    params: { id: string; name: string };
    result: DatasetStatus | null;
  };
  removeDataset: {
    params: { id: string };
    result: "removed" | "busy" | "missing";
  };
  /** 스키마(테이블에서 읽은 컬럼과 타입) + 고유값 수. 등록하지 않은 데이터셋이면 null */
  datasetColumns: { params: { dataset: string }; result: ColumnInfo[] | null };
  /** 적재가 끝나 조회·집계를 받을 수 있는지 */
  datasetReady: { params: { dataset: string }; result: boolean };
  /** split 조합 개수. exact가 false면 고유값 곱으로 낸 상한이다. */
  splitCount: {
    params: {
      dataset: string;
      cols: string[];
      limit: number;
      filters?: ChartFilter[];
    };
    result: { count: number; exact: boolean };
  };
  /** job 하나에 필요한 데이터를 한 번에 조회해 split 조합별로 나눈다. */
  chartData: {
    params: Omit<ChartDataParams, "table"> & { dataset: string };
    result: ChartData;
  };
  /** bar / boxplot: SQL로 집계한 split 조합 × 범주 값 */
  categoryData: {
    params: Omit<CategoryDataParams, "table"> & { dataset: string };
    result: CategoryData;
  };
  /** sankey: SQL로 집계한 split 조합 × 출발 → 도착 흐름 */
  sankeyData: {
    params: Omit<SankeyDataParams, "table"> & { dataset: string };
    result: SankeyData;
  };
  /** heatmap: SQL로 집계한 split 조합 × x × y 칸 값 */
  heatmapData: {
    params: Omit<HeatmapDataParams, "table"> & { dataset: string };
    result: HeatmapData;
  };
  /** histogram: 전체 범위에서 정한 구간 × split 조합 × legend 값 개수 */
  histogramData: {
    params: Omit<HistogramDataParams, "table"> & { dataset: string };
    result: HistogramData;
  };
  /** candle: 자동 시간 구간별 OHLC */
  candleData: {
    params: Omit<CandleDataParams, "table"> & { dataset: string };
    result: CandleData;
  };
  /** gantt: 행마다 같은 legend 값이 이어지는 구간 */
  ganttData: {
    params: Omit<GanttDataParams, "table"> & { dataset: string };
    result: GanttData;
  };
  /** pie: bar와 같은 SQL 집계를 큰 순 조각(상위 N + 기타)으로. legend가 있으면 sunburst 바깥 고리도 붙인다. */
  pieData: {
    params: Omit<CategoryDataParams, "table" | "chartType" | "legend"> & {
      dataset: string;
      /** sunburst 바깥 고리를 나눌 legend 컬럼. 없으면 조각만 */
      sunburst?: string | null;
    };
    result: PieData;
  };
  /** radar: bar와 같은 SQL 집계(legend 값별)를 축(상위 N)으로 */
  radarData: {
    params: Omit<CategoryDataParams, "table" | "chartType"> & {
      dataset: string;
    };
    result: RadarData;
  };
  historySave: { params: HistoryDetail; result: undefined };
  historyList: { params: undefined; result: HistorySummary[] };
  historyGet: { params: { id: string }; result: HistoryDetail | null };
  /** 없던 건이면 false */
  historyDelete: { params: { id: string }; result: boolean };
  /** 공유 저장. PNG 바이트는 transfer로 넘긴다. */
  shareSave: { params: StoredShare; result: Share };
  shareGet: { params: { id: string }; result: Share | null };
  /** 만든 사용자의 공유 목록 (최근 순) */
  shareList: { params: { createdBy: string }; result: Share[] };
  sharePng: { params: { id: string }; result: Uint8Array | null };
  /** 피드 op 하나 (op 이름과 인자는 server/feed/ops.ts). 도메인 오류는 결과로 돌려준다. */
  feed: { params: FeedRequest; result: FeedReply };
  /** 피드 스키마를 지우고 빈 스키마로 다시 만든다 (/feed/dev/seed 리셋) */
  feedReset: { params: undefined; result: undefined };
  /**
   * 미뤄 둔 IndexedDB 쓰기를 기다린다 (relaxedDurability). 시드처럼 데이터가 통째로 바뀐 직후
   * 새로고침해도 사라지지 않게, 시드 적재·리셋·가져오기 뒤에 부른다.
   */
  feedFlush: { params: undefined; result: undefined };
  /** 만든 사용자의 공유만 지운다. 지웠으면 true */
  shareDelete: { params: { id: string; createdBy: string }; result: boolean };
  legendValues: {
    params: { dataset: string; column: string };
    result: string[];
  };
  /** 필터 패널: 컬럼 하나의 범위(숫자·시계열) 또는 값별 개수(범주) */
  columnSummary: {
    params: { dataset: string; column: string };
    result: ColumnSummary;
  };
  /** 데이터 표: item이 그린 행 한 페이지. 모르는 데이터셋(지운 업로드)이면 null */
  itemRows: {
    params: {
      dataset: string;
      scope: ItemRowsScope;
      page: {
        offset: number;
        limit: number;
        sort?: { column: string; desc: boolean };
      };
    };
    result: ItemRowsPage | null;
  };
  /** 전체 데이터 표: 필터에 맞는 행 중 최대 30,000행 샘플 한 페이지. 모르는 데이터셋이면 null */
  sampleRows: {
    params: {
      dataset: string;
      filters?: ChartFilter[];
      page: {
        offset: number;
        limit: number;
        sort?: { column: string; desc: boolean };
      };
    };
    result: SampleRowsPage | null;
  };
  /** 데이터 다운로드: item이 그린 행 전체 CSV. 모르는 데이터셋이면 null */
  exportItemRows: {
    params: { dataset: string; scope: ItemRowsScope };
    result: Blob | null;
  };
  /** 툴팁 추가 컬럼 조회. 모르는 데이터셋(지운 업로드)이면 null */
  rowValues: {
    params: { dataset: string; rowId: number; columns: string[] };
    result: Record<string, string | number | null> | null;
  };
};

type Size = { width: number; height: number };
/** 모든 차트 렌더에 덧붙이는 입력. pixelRatio배 캔버스에 그리고, thumbnail 크기를 주면 섬네일도 함께 그린다. */
type RenderExtras = { thumbnail?: Size; pixelRatio?: number };

export type RenderMethods = {
  /** 1단계 검증용: 임의의 점을 그려 PNG를 만든다. */
  renderTest: {
    params: { width: number; height: number; label: string; points: number };
    result: { png: ArrayBuffer; worker: string; ms: number };
  };
  /** thumbnail 크기를 주면 같은 입력으로 축 없는 섬네일도 함께 그린다. */
  renderScatter: {
    params: ScatterInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: ScatterMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderCategory: {
    params: CategoryInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: CategoryMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderSankey: {
    params: SankeyInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: SankeyMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderHeatmap: {
    params: HeatmapInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: HeatmapMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderTreemap: {
    params: TreemapInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: TreemapMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderCandle: {
    params: CandleInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: CandleMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderGantt: {
    params: GanttInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: GanttMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderPie: {
    params: PieInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: PieMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderRadar: {
    params: RadarInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: RadarMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderHistogram: {
    params: HistogramInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: HistogramMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderWaterfall: {
    params: WaterfallInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: WaterfallMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
  renderFunnel: {
    params: FunnelInput & RenderExtras;
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: FunnelMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
};
