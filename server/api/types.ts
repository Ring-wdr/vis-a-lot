// 화면 ↔ mock 서버 REST API의 요청/응답 타입. 실서버로 옮겨도 이 계약은 유지한다.

import type { ColumnDef, RowSize } from "../data/schema";

export type HealthResponse = {
  db: { version: string; bootCount: number; bootMs: number };
  renderWorkers: number;
};

export const DATASET_STATES = ["missing", "generating", "ready"] as const;
export type DatasetState = (typeof DATASET_STATES)[number];

export type DatasetStatus = {
  rows: RowSize;
  state: DatasetState;
  /** generating일 때: copy(행 적재) → analyze(컬럼 통계) */
  phase?: "copy" | "analyze";
  done: number;
  total: number;
  generateMs?: number;
};

export type DatasetListResponse = { datasets: DatasetStatus[] };

export type GenerateDatasetRequest = { rows: RowSize };

export type ColumnInfo = ColumnDef & { distinct: number };

export type ColumnsResponse = { rows: RowSize; columns: ColumnInfo[] };

export type DebugRenderRequest = {
  chartId: string;
  itemKey: string;
  width: number;
  height: number;
  points: number;
};

export type DebugRenderResponse = {
  url: string;
  width: number;
  height: number;
  worker: string;
  renderMs: number;
};

export type ApiError = { error: string };
