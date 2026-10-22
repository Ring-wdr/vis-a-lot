// 화면이 쓰는 API 타입. 모두 서비스 OAS에서 생성한 타입(generated/*)에서 꺼내 온다.
// 서버 코드를 직접 import하지 않으므로, 실서버로 바꿔도 OAS만 같으면 화면은 그대로다.

import type { components as AuthSchemas } from "./generated/auth";
import type { components as ChartSchemas } from "./generated/chart";
import type { components as DataSchemas } from "./generated/data";

type Chart = ChartSchemas["schemas"];
type Data = DataSchemas["schemas"];
type Auth = AuthSchemas["schemas"];

export type ApiError = Chart["ApiError"];

// ── auth ───────────────────────────────────────────────────────
export type User = Auth["User"];
export type TokenResponse = Auth["TokenResponse"];

// ── data ───────────────────────────────────────────────────────
export type DatasetId = Data["DatasetId"];
export type ColumnType = Data["ColumnType"];
export type DatasetStatus = Data["DatasetStatus"];
export type DatasetListResponse = Data["DatasetListResponse"];
export type CsvOptions = Data["CsvOptions"];
export type UploadInfo = Data["UploadInfo"];
export type CsvEncoding = CsvOptions["encoding"];
export type StagedUpload = Data["StagedUpload"];
export type CsvPreview = Data["CsvPreview"];
export type CsvCheck = Data["CsvCheck"];
export type UploadTask = Data["UploadTask"];
export type ColumnInfo = Data["ColumnInfo"];
export type DatasetSchema = Data["DatasetSchema"];
export type SplitCountResponse = Data["SplitCountResponse"];
export type LegendValuesResponse = Data["LegendValuesResponse"];
export type ColumnSummary = Data["ColumnSummary"];

// ── chart ──────────────────────────────────────────────────────
export type ColumnName = Chart["ColumnName"];
export type AggFn = Chart["AggFn"];
export type ChartType = Chart["ChartType"];
export type ChartSubType = Chart["ChartSubType"];
export type ChartSpec = Chart["ChartSpec"];
export type ChartFilter = Chart["ChartFilter"];
export type RangeFilter = Chart["RangeFilter"];
export type ExcludeFilter = Chart["ExcludeFilter"];
export type CommonProps = Chart["CommonProps"];
/** 차트 속성 부분 값 (공통·item 개별). 화면 쪽 모양·기본값은 entities/chart/model/chart-options */
export type ChartOptionsBody = Chart["ChartOptions"];
export type LegendPosition = Chart["LegendPosition"];
export type ItemSize = Chart["ItemSize"];
export type ItemView = Chart["ItemView"];
export type ItemRestore = Chart["ItemRestore"];
export type Shape = Chart["Shape"];
export type Region = Chart["Region"];
export type Favorite = Chart["Favorite"];
export type ShapeType = Shape["type"];
export type CreateChartRequest = Chart["CreateChartRequest"];
export type CreateChartResponse = Chart["CreateChartResponse"];
export type ItemJobResponse = Chart["ItemJobResponse"];
export type DetailResponse = Chart["DetailResponse"];
export type JobStatus = Chart["JobStatus"];
export type ItemStatus = Chart["ItemStatus"];
export type ItemStage = Chart["ItemStage"];
export type ItemState = Chart["ItemState"];
export type ItemRowsRequest = Chart["ItemRowsRequest"];
export type ItemRowsResponse = Chart["ItemRowsResponse"];
export type SampleRowsResponse = Chart["SampleRowsResponse"];
export type JobStateResponse = Chart["JobStateResponse"];
export type ChartImage = Chart["ChartImage"];
export type ViewRequest = Chart["ViewRequest"];
export type TooltipRequest = Chart["TooltipRequest"];
export type TooltipResponse = Chart["TooltipResponse"];
export type AxisMeta = Chart["AxisMeta"];
export type ScatterMeta = Chart["ScatterMeta"];
export type CategoryMeta = Chart["CategoryMeta"];
export type SankeyMeta = Chart["SankeyMeta"];
export type HeatmapMeta = Chart["HeatmapMeta"];
export type TreemapMeta = Chart["TreemapMeta"];
export type CandleMeta = Chart["CandleMeta"];
export type GanttMeta = Chart["GanttMeta"];
export type PieMeta = Chart["PieMeta"];
export type RadarMeta = Chart["RadarMeta"];
export type HistogramMeta = Chart["HistogramMeta"];
export type WaterfallMeta = Chart["WaterfallMeta"];
export type FunnelMeta = Chart["FunnelMeta"];
export type ItemMeta = Chart["ItemMeta"];
export type HistoryEventType = Chart["HistoryEventType"];
export type HistorySummary = Chart["HistorySummary"];
export type HistoryDetail = Chart["HistoryDetail"];
export type HistoryListResponse = Chart["HistoryListResponse"];
export type DebugRenderRequest = Chart["DebugRenderRequest"];
export type DebugRenderResponse = Chart["DebugRenderResponse"];

// ── 런타임 값 ──────────────────────────────────────────────────
// 생성된 union을 키로 하는 Record에서 목록을 뽑아, 서버 enum에 값이 늘면 여기서 컴파일 에러가 난다.

const CHART_TYPE_SET: Record<ChartType, true> = {
  scatter: true,
  bar: true,
  boxplot: true,
  line: true,
  sankey: true,
  heatmap: true,
  treemap: true,
  candle: true,
  gantt: true,
  pie: true,
  radar: true,
  histogram: true,
  waterfall: true,
  funnel: true,
};
export const CHART_TYPES = Object.keys(CHART_TYPE_SET) as ChartType[];

/** 끝난 상태. long polling 해제와 버튼 상태 판단이 모두 이 목록을 기준으로 한다. */
export const TERMINAL_STATUSES = [
  "success",
  "failed",
  "cancelled",
] as const satisfies readonly (JobStatus & ItemStatus)[];
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function isTerminal(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}
