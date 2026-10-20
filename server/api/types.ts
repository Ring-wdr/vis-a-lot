// 화면 ↔ mock 서버 REST API의 요청/응답 타입. 실서버로 옮겨도 이 계약은 유지한다.

import type { BoxStats } from "../data/category-data";
import type { AggFn, ColumnDef, ColumnName, RowSize } from "../data/schema";
import type { CategoryMeta } from "../render/category";
import type { AxisMeta, ItemView, ScatterMeta } from "../render/scatter";
import type { Shape, ShapeType } from "../render/shapes";

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

export type SplitCountResponse = {
  count: number;
  /** false면 컬럼별 고유값 곱으로 낸 상한이다. */
  exact: boolean;
  limit: number;
};

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
  /** bar의 통계 함수 */
  agg: AggFn;
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

export type {
  AxisMeta,
  BoxStats,
  CategoryMeta,
  ItemView,
  ScatterMeta,
  Shape,
  ShapeType,
};

/** 차트 종류별 metadata */
export type ItemMeta = ScatterMeta | CategoryMeta;

export type ViewRequest =
  | { type: "zoomIn"; x: [number, number]; y: [number, number] }
  | { type: "zoomOut"; ratio: number }
  | { type: "reset" };

export type AddShapeRequest = { shape: Shape };

/** item 하나(또는 몇 개)를 다시 그리는 job */
export type ItemJobResponse = { jobId: string };

export type TooltipRequest = { rowId: number; columns: ColumnName[] };
export type TooltipResponse = {
  values: Record<string, string | number | null>;
};

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
  /** 확대 중인지. 축소/초기화 버튼 활성화에 쓴다. */
  zoomed: boolean;
  shapeCount: number;
};

export type JobStateResponse = {
  jobId: string;
  chartId: string;
  /** 상태가 바뀔 때마다 올라간다. long polling의 since 값으로 돌려보낸다. */
  version: number;
  status: JobStatus;
  phase: JobPhase;
  /** dataset 단계에서는 생성 행 수, 그 뒤로는 끝난 item 수 */
  progress: { done: number; total: number };
  /** 조회가 끝나기 전에는 item 개수를 모른다. */
  totalItems: number | null;
  page: number;
  pageSize: number;
  items: ItemState[];
  /** job이 failed로 끝난 이유 (예: split 조합 개수 초과) */
  error?: string;
};
