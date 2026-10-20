// 서비스 API 호출 모음. 화면은 이 함수들로만 서버와 통신하고, 경로·파라미터·응답 타입은
// 모두 OAS에서 생성한 client가 검사한다.

import { DATASET_ID } from "@/shared/config/dataset";
import { chartClient, dataClient } from "./clients";
import type {
  ChartFilter,
  ChartSpec,
  ColumnName,
  CommonProps,
  CreateChartRequest,
  DebugRenderRequest,
  HistoryDetail,
  ItemMeta,
  ItemSize,
  LegendColumn,
  RowSize,
  Shape,
  TooltipRequest,
  ViewRequest,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Result<T> = {
  data?: T;
  error?: { error: string } | unknown;
  response: Response;
};

/** 성공이면 body를, 아니면 서버가 준 사유로 ApiRequestError를 던진다. */
async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (response.ok) return data as T;
  const message =
    error && typeof error === "object" && "error" in error
      ? String(error.error)
      : `HTTP ${response.status}`;
  throw new ApiRequestError(response.status, message);
}

/**
 * openapi-fetch는 응답 타입을 Readable<>로 감싸면서 tuple([number, number])을 number[]로 넓힌다.
 * tuple이 든 응답은 생성된 컴포넌트 타입으로 되돌린다. T가 실제 응답 타입에 들어맞을 때만 컴파일된다.
 */
function as<T>() {
  return <D>(promise: Promise<D> & ([T] extends [D] ? unknown : never)) =>
    promise as unknown as Promise<T>;
}

const dataset = { datasetId: DATASET_ID } as const;
const item = (chartId: string, itemKey: string) => ({ chartId, itemKey });

/** PNG URL(`/api/chart/charts/{chartId}/items/{itemKey}/png?v=…`)에서 item을 꺼낸다. */
function itemOfPng(pngUrl: string) {
  const match = new URL(pngUrl, location.origin).pathname.match(
    /\/charts\/([^/]+)\/items\/([^/]+)\/png$/,
  );
  if (!match) throw new Error(`not a chart png url: ${pngUrl}`);
  return item(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
}

export const api = {
  // ── data 서비스 ─────────────────────────────────────────────
  health: () => unwrap(dataClient.GET("/health")),

  datasets: () =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}", { params: { path: dataset } }),
    ),

  generateDataset: (rows: RowSize) =>
    unwrap(
      dataClient.POST("/datasets/{datasetId}/generate", {
        params: { path: dataset },
        body: { rows },
      }),
    ),

  columns: (rows: RowSize) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/columns", {
        params: { path: dataset, query: { rows } },
      }),
    ),

  splitCount: (rows: RowSize, cols: ColumnName[], filters?: ChartFilter[]) =>
    unwrap(
      dataClient.POST("/datasets/{datasetId}/split-count", {
        params: { path: dataset },
        body: { rows, cols, filters },
      }),
    ),

  /** 필터 패널: 아코디언을 열 때 그 컬럼의 범위나 값 목록을 받는다. */
  columnSummary: (rows: RowSize, column: ColumnName) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/columns/{column}/summary", {
        params: { path: { ...dataset, column }, query: { rows } },
      }),
    ),

  legendValues: (rows: RowSize, column: LegendColumn) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/legend-values", {
        params: { path: dataset, query: { rows, column } },
      }),
    ),

  // ── chart 서비스: 그리기 job ────────────────────────────────
  createChart: (body: CreateChartRequest) =>
    unwrap(chartClient.POST("/charts", { body })),

  /** long polling. since 이후 변화가 생기거나 페이지가 모두 끝나면 응답이 온다. */
  job: (
    jobId: string,
    page: number,
    pageSize: number,
    since: number,
    signal?: AbortSignal,
  ) =>
    unwrap(
      chartClient.GET("/jobs/{jobId}", {
        params: { path: { jobId }, query: { page, pageSize, since } },
        signal,
      }),
    ),

  /** 지정한 item들의 상태를 long polling으로 받는다. */
  jobItems: (
    jobId: string,
    keys: string[],
    since: number,
    signal?: AbortSignal,
  ) =>
    unwrap(
      chartClient.GET("/jobs/{jobId}", {
        params: { path: { jobId }, query: { items: keys.join(","), since } },
        signal,
      }),
    ),

  cancelJob: (jobId: string) =>
    unwrap(
      chartClient.POST("/jobs/{jobId}/cancel", { params: { path: { jobId } } }),
    ),

  // ── chart 서비스: history ───────────────────────────────────
  history: () => unwrap(chartClient.GET("/history")),

  historyDetail: (id: string) =>
    as<HistoryDetail>()(
      unwrap(chartClient.GET("/history/{id}", { params: { path: { id } } })),
    ),

  // ── chart 서비스: 툴팁 ──────────────────────────────────────
  /** PNG와 같은 item의 metadata */
  itemMeta: (pngUrl: string) =>
    as<ItemMeta>()(
      unwrap(
        chartClient.GET("/charts/{chartId}/items/{itemKey}/meta", {
          params: { path: itemOfPng(pngUrl) },
        }),
      ),
    ),

  tooltip: (chartId: string, itemKey: string, body: TooltipRequest) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/tooltip", {
        params: { path: item(chartId, itemKey) },
        body,
      }),
    ),

  // ── chart 서비스: item 조작 ─────────────────────────────────
  changeView: (chartId: string, itemKey: string, body: ViewRequest) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/view", {
        params: { path: item(chartId, itemKey) },
        body,
      }),
    ),

  addShape: (chartId: string, itemKey: string, body: { shape: Shape }) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/shapes", {
        params: { path: item(chartId, itemKey) },
        body,
      }),
    ),

  undoShape: (chartId: string, itemKey: string) =>
    unwrap(
      chartClient.DELETE("/charts/{chartId}/items/{itemKey}/shapes/last", {
        params: { path: item(chartId, itemKey) },
      }),
    ),

  clearShapes: (chartId: string, itemKey: string) =>
    unwrap(
      chartClient.DELETE("/charts/{chartId}/items/{itemKey}/shapes", {
        params: { path: item(chartId, itemKey) },
      }),
    ),

  setItemColor: (chartId: string, itemKey: string, color: string | null) =>
    unwrap(
      chartClient.PATCH("/charts/{chartId}/items/{itemKey}/props", {
        params: { path: item(chartId, itemKey) },
        body: { color },
      }),
    ),

  setItemLegendColor: (
    chartId: string,
    itemKey: string,
    value: string,
    color: string | null,
  ) =>
    unwrap(
      chartClient.PATCH("/charts/{chartId}/items/{itemKey}/props", {
        params: { path: item(chartId, itemKey) },
        body: { legendColor: { value, color } },
      }),
    ),

  // ── chart 서비스: 차트 전체 ─────────────────────────────────
  updateCommon: (chartId: string, common: CommonProps) =>
    unwrap(
      chartClient.PATCH("/charts/{chartId}/common", {
        params: { path: { chartId } },
        body: { common },
      }),
    ),

  changeGrid: (chartId: string, grid: ChartSpec["grid"], itemSize: ItemSize) =>
    unwrap(
      chartClient.PATCH("/charts/{chartId}/grid", {
        params: { path: { chartId } },
        body: { grid, itemSize },
      }),
    ),

  resizeItems: (chartId: string, itemSize: ItemSize, keys: string[]) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/resize", {
        params: { path: { chartId } },
        body: { itemSize, keys },
      }),
    ),

  debugRender: (body: DebugRenderRequest) =>
    unwrap(chartClient.POST("/debug/render", { body })),

  chartHealth: () => unwrap(chartClient.GET("/health")),
};
