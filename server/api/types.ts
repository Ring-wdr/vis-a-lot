// 화면 ↔ mock 서버 REST API의 요청/응답 타입. 실서버로 옮겨도 이 계약은 유지한다.

import type { z } from "@hono/zod-openapi";
import type { BoxStats } from "../data/category-data";
import type { ColumnInfo } from "../data/datasets";
import type { ChartFilter } from "../data/filters";
import type { AggFn, RowSize } from "../data/schema";

/** 컬럼 이름. 데이터셋마다 다르며 스키마로 확인한다. */
type ColumnName = string;

import type { CategoryMeta } from "../render/category";
import type { LegendPosition } from "../render/legend";
import type { AxisMeta, ItemView, ScatterMeta } from "../render/scatter";
import type { Shape, ShapeType } from "../render/shapes";
import type { JobStateResponseSchema } from "../services/chart/schemas";

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

export type { ColumnInfo };

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

export type CommonProps = {
  /** legend가 없을 때의 색 */
  color: string;
  /** legend 값별 색. 없는 값은 팔레트 순서대로 기본 색을 쓴다. */
  legendColors?: Record<string, string>;
  /** legend 위치. 없으면 위 */
  legendPosition?: LegendPosition;
};

/** item 개별 속성. 공통 속성보다 우선한다. */
export type ItemProps = {
  color?: string;
  legendColors?: Record<string, string>;
  legendPosition?: LegendPosition;
};

export type ChartSpec = {
  rows: RowSize;
  chartType: ChartType;
  x: ColumnName;
  y: ColumnName;
  /** bar의 통계 함수 */
  agg: AggFn;
  /** 색을 나눌 범주 컬럼. null이면 한 가지 색 */
  legend: ColumnName | null;
  /** 클릭한 순서가 곧 조합 순서다. */
  splitBy: ColumnName[];
  splitSeparator: string;
  tooltip: ColumnName[];
  grid: { rows: number; cols: number };
  common: CommonProps;
  /** draw할 때 적용하는 데이터 필터. 예전 history에는 없을 수 있다. */
  filters?: ChartFilter[];
};

export type ItemSize = { width: number; height: number };

/** 복원할 item 상태. split 조합 키에 붙는다. */
export type ItemRestore = {
  view?: ItemView;
  shapes: Shape[];
  color?: string;
  legendColors?: Record<string, string>;
  legendPosition?: LegendPosition;
};

export type CreateChartRequest = {
  spec: ChartSpec;
  itemSize: ItemSize;
  /** history 복원이나 공유 링크로 열 때, 키별 확대·도형·개별 색 */
  restore?: Record<string, ItemRestore>;
  /** 이어서 기록할 history. 없으면 새로 만든다. */
  historyId?: string;
  /** false면 history에 남기지 않는다 (history 다시 보기). historyId는 빈 문자열로 온다. */
  record?: boolean;
};
export type CreateChartResponse = {
  chartId: string;
  jobId: string;
  historyId: string;
};

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

/** 공통 속성 변경. 개별 속성을 모두 덮어쓰고 전체를 다시 그린다. */
export type CommonPropsRequest = { common: CommonProps };

/** grid 크기 변경. item 크기가 바뀌므로 전체를 다시 그린다. */
export type GridRequest = { grid: ChartSpec["grid"]; itemSize: ItemSize };

/** 화면 크기 변경. 요청한 item만 새 크기로 다시 그린다. */
export type ResizeRequest = { itemSize: ItemSize; keys: string[] };

/**
 * 개별 색상. color는 legend가 없을 때의 색, legendColor는 legend 값 하나의 색이다.
 * 색이 null이면 공통 속성을 따르도록 되돌린다.
 */
export type ItemPropsRequest =
  | { color: string | null }
  | { legendColor: { value: string; color: string | null } }
  | { legendPosition: LegendPosition | null };

export type LegendValuesResponse = { column: ColumnName; values: string[] };

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** item 하나(또는 몇 개)를 다시 그리는 job */
export type ItemJobResponse = { jobId: string };

/** 크게 보기용 PNG. 그 크기로 그려 둔 게 있으면 바로 image를, 없으면 그리는 job을 준다. */
export type DetailRequest = { itemSize: ItemSize };
export type DetailResponse = { image: ChartImage } | { jobId: string };

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
  /** 고정 크기 섬네일. 크게 보기 화면 하단 목록에 쓴다. */
  thumbnail?: ChartImage;
  /** 그림 내용이 바뀔 때마다 올라간다. 크기만 바뀌면 그대로다. */
  revision: number;
  error?: string;
  /** 확대 중인지. 축소/초기화 버튼 활성화에 쓴다. */
  zoomed: boolean;
  shapeCount: number;
  /** 실제로 그린 색 */
  color: string;
  /** 개별 색을 지정했는지 */
  customColor: boolean;
  /** item에 따로 정한 legend 위치. 없으면 공통 속성을 따른다. */
  legendPosition?: LegendPosition;
};

/** long polling 응답. 형태는 chart 서비스 OAS 스키마가 정한다. */
export type JobStateResponse = z.infer<typeof JobStateResponseSchema>;

// ── history ────────────────────────────────────────────────────────

/** draw 뒤에 덧붙는 변경 */
export const HISTORY_EVENT_TYPES = [
  "zoom",
  "shape",
  "undo",
  "clearShapes",
  "color",
  "legend",
  "common",
  "grid",
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export type HistoryEvent = {
  type: HistoryEventType;
  at: number;
  item?: string;
};

export type HistoryItem = ItemRestore & {
  label: string;
  status: ItemStatus;
};

export type HistorySummary = {
  id: string;
  createdAt: number;
  updatedAt: number;
  rows: RowSize;
  generatorVersion: number;
  spec: ChartSpec;
  status: JobStatus;
  itemCount: number;
  /** 상태별 item 수 (cancelled 포함) */
  statusCounts: Partial<Record<ItemStatus, number>>;
  eventCounts: Partial<Record<HistoryEventType, number>>;
  thumbnail?: string;
};

export type HistoryDetail = HistorySummary & {
  items: Record<string, HistoryItem>;
  events: HistoryEvent[];
};

export type HistoryListResponse = { entries: HistorySummary[] };
