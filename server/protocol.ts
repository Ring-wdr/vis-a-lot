// Worker별 RPC 메서드 정의.

import type { DatasetStatus, HistoryDetail, HistorySummary } from "./api/types";
import type { CategoryData, CategoryDataParams } from "./data/category-data";
import type { ChartData, ChartDataParams } from "./data/chart-data";
import type { ColumnSummary } from "./data/column-summary";
import type { CsvOptions } from "./data/csv-import";
import type { ColumnInfo, UploadResult } from "./data/datasets";
import type { ChartFilter } from "./data/filters";
import type { CategoryInput, CategoryMeta } from "./render/category";
import type { RenderStage, ScatterInput, ScatterMeta } from "./render/scatter";

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
  /** CSV·zip 업로드. 스키마가 맞지 않으면 거절 사유를 돌려준다. */
  uploadDataset: {
    params: {
      name: string;
      fileName: string;
      bytes: ArrayBuffer;
      options: CsvOptions;
    };
    result: UploadResult;
  };
  /** 업로드한 데이터셋의 이름·전처리 옵션 변경. 모르는 데이터셋이면 null */
  editDataset: {
    params: { id: string; name?: string; options?: CsvOptions };
    result: UploadResult | null;
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
  historySave: { params: HistoryDetail; result: undefined };
  historyList: { params: undefined; result: HistorySummary[] };
  historyGet: { params: { id: string }; result: HistoryDetail | null };
  legendValues: {
    params: { dataset: string; column: string };
    result: string[];
  };
  /** 필터 패널: 컬럼 하나의 범위(숫자·시계열) 또는 값별 개수(범주) */
  columnSummary: {
    params: { dataset: string; column: string };
    result: ColumnSummary;
  };
  /** 툴팁 추가 컬럼 조회 */
  rowValues: {
    params: { dataset: string; rowId: number; columns: string[] };
    result: Record<string, string | number | null>;
  };
};

type Size = { width: number; height: number };

export type RenderMethods = {
  /** 1단계 검증용: 임의의 점을 그려 PNG를 만든다. */
  renderTest: {
    params: { width: number; height: number; label: string; points: number };
    result: { png: ArrayBuffer; worker: string; ms: number };
  };
  /** thumbnail 크기를 주면 같은 입력으로 축 없는 섬네일도 함께 그린다. */
  renderScatter: {
    params: ScatterInput & { thumbnail?: Size };
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
    params: CategoryInput & { thumbnail?: Size };
    result: {
      png: ArrayBuffer;
      thumb?: ArrayBuffer;
      meta: CategoryMeta;
      worker: string;
      ms: number;
    };
    progress: { stage: RenderStage | "encode"; ratio: number };
  };
};
