// 화면 ↔ mock 서버 REST API의 요청/응답 타입. 실서버로 옮겨도 이 계약은 유지한다.

import type { ColumnDef, ColumnName, RowSize } from "../data/schema";

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

// ── 차트 ────────────────────────────────────────────────────────────

export const CHART_TYPES = ["scatter", "bar", "boxplot"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export type CommonProps = { color: string };

export type ChartSpec = {
  rows: RowSize;
  chartType: ChartType;
  x: ColumnName;
  y: ColumnName;
  /** 클릭한 순서가 곧 조합 순서다. */
  splitBy: ColumnName[];
  splitSeparator: string;
  tooltip: ColumnName[];
  grid: { rows: number; cols: number };
  common: CommonProps;
};

export type ItemSize = { width: number; height: number };

export type CreateChartRequest = { spec: ChartSpec; itemSize: ItemSize };
export type CreateChartResponse = { chartId: string; jobId: string };

export type ChartImage = { url: string; width: number; height: number };

// ── 렌더 job ────────────────────────────────────────────────────────

/** 끝난 상태. long polling 해제와 버튼 상태 판단이 모두 이 tuple을 기준으로 한다. */
export const TERMINAL_STATUSES = ["success", "failed", "cancelled"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminal(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type JobStatus = "init" | "progress" | TerminalStatus;
export type ItemStatus = "queued" | "running" | TerminalStatus;

export const ITEM_STAGES = ["query", "aggregate", "render", "encode"] as const;
export type ItemStage = (typeof ITEM_STAGES)[number];

/** job 전체 단계: 데이터셋 준비 → 데이터 조회 → item 렌더 */
export type JobPhase = "dataset" | "query" | "render";

export type ItemState = {
  key: string;
  label: string;
  status: ItemStatus;
  stage?: ItemStage;
  /** 현재 단계 안에서의 진행률 0..1 */
  stageProgress: number;
  image?: ChartImage;
  error?: string;
};

export type JobStateResponse = {
  jobId: string;
  chartId: string;
  status: JobStatus;
  phase: JobPhase;
  /** dataset 단계에서는 생성 행 수, 그 뒤로는 끝난 item 수 */
  progress: { done: number; total: number };
  /** 조회가 끝나기 전에는 item 개수를 모른다. */
  totalItems: number | null;
  page: number;
  pageSize: number;
  items: ItemState[];
};
