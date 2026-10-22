// 서비스 API 호출 모음. 화면은 이 함수들로만 서버와 통신하고, 경로·파라미터·응답 타입은
// 모두 OAS에서 생성한 client가 검사한다.

import { chartClient, dataClient } from "./clients";
import type {
  ChartFilter,
  ChartSpec,
  ColumnName,
  CommonProps,
  CreateChartRequest,
  CsvOptions,
  CsvPreview,
  DatasetId,
  DebugRenderRequest,
  HistoryDetail,
  ItemMeta,
  ItemSize,
  JobStateResponse,
  LegendPosition,
  Region,
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

const dataset = (datasetId: DatasetId) => ({ datasetId });
const item = (chartId: string, itemKey: string) => ({ chartId, itemKey });

/** PNG URL(`/api/chart/charts/{chartId}/items/{itemKey}/png?v=…`)에서 item을 꺼낸다. */
function itemOfPng(pngUrl: string) {
  const match = new URL(pngUrl, location.origin).pathname.match(
    /\/charts\/([^/]+)\/items\/([^/]+)\/png$/,
  );
  if (!match) throw new Error(`not a chart png url: ${pngUrl}`);
  return item(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
}

/** 크게 보기 PNG면 그 크기(size=WxH)를 꺼낸다. grid PNG에는 없다. */
function sizeOfPng(pngUrl: string) {
  const size = new URL(pngUrl, location.origin).searchParams.get("size");
  return { size: size ?? undefined };
}

export const api = {
  // ── data 서비스 ─────────────────────────────────────────────
  health: () => unwrap(dataClient.GET("/health")),

  datasets: () => unwrap(dataClient.GET("/datasets")),

  generateDataset: (id: DatasetId) =>
    unwrap(
      dataClient.POST("/datasets/{datasetId}/generate", {
        params: { path: dataset(id) },
      }),
    ),

  /** CSV 또는 zip을 올려 둔다. 옵션은 미리보기·검사로 정하고 commit으로 적재한다. */
  stageUpload: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return unwrap(
      dataClient.POST("/datasets/staging", {
        // openapi-fetch는 FormData를 그대로 보내고 boundary는 브라우저가 붙인다.
        body: form as never,
      }),
    );
  },

  /** 업로드한 데이터셋의 원본을 다시 올려 둔다 (수정). */
  stageDataset: (id: DatasetId) =>
    unwrap(
      dataClient.POST("/datasets/{datasetId}/staging", {
        params: { path: dataset(id) },
      }),
    ),

  discardStage: (stageId: string) =>
    unwrap(
      dataClient.DELETE("/datasets/staging/{stageId}", {
        params: { path: { stageId } },
      }),
    ),

  previewUpload: (
    stageId: string,
    body: { file: number; options: CsvOptions },
    signal?: AbortSignal,
  ) =>
    as<CsvPreview>()(
      unwrap(
        dataClient.POST("/datasets/staging/{stageId}/preview", {
          params: { path: { stageId } },
          body,
          signal,
        }),
      ),
    ),

  checkUpload: (stageId: string, options: CsvOptions) =>
    unwrap(
      dataClient.POST("/datasets/staging/{stageId}/check", {
        params: { path: { stageId } },
        body: { options },
      }),
    ),

  commitUpload: (
    stageId: string,
    body: { name: string; options: CsvOptions },
  ) =>
    unwrap(
      dataClient.POST("/datasets/staging/{stageId}/commit", {
        params: { path: { stageId } },
        body,
      }),
    ),

  /** 업로드 진행 (long polling). since가 지금 버전과 같으면 바뀔 때까지 기다린다. */
  uploadTask: (
    stageId: string,
    since: number | undefined,
    signal?: AbortSignal,
  ) =>
    unwrap(
      dataClient.GET("/datasets/staging/{stageId}/task", {
        params: { path: { stageId }, query: { since } },
        signal,
      }),
    ),

  renameDataset: (id: DatasetId, name: string) =>
    unwrap(
      dataClient.PATCH("/datasets/{datasetId}", {
        params: { path: dataset(id) },
        body: { name },
      }),
    ),

  deleteDataset: (id: DatasetId) =>
    unwrap(
      dataClient.DELETE("/datasets/{datasetId}", {
        params: { path: dataset(id) },
      }),
    ),

  /** 데이터셋 스키마: 적재된 테이블의 컬럼과 타입. 등록 전이면 409 */
  schema: (id: DatasetId) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/schema", {
        params: { path: dataset(id) },
      }),
    ),

  splitCount: (id: DatasetId, cols: ColumnName[], filters?: ChartFilter[]) =>
    unwrap(
      dataClient.POST("/datasets/{datasetId}/split-count", {
        params: { path: dataset(id) },
        body: { cols, filters },
      }),
    ),

  /** 필터 패널: 아코디언을 열 때 그 컬럼의 범위나 값 목록을 받는다. */
  columnSummary: (id: DatasetId, column: ColumnName) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/columns/{column}/summary", {
        params: { path: { ...dataset(id), column } },
      }),
    ),

  legendValues: (id: DatasetId, column: ColumnName) =>
    unwrap(
      dataClient.GET("/datasets/{datasetId}/legend-values", {
        params: { path: dataset(id), query: { column } },
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
    as<JobStateResponse>()(
      unwrap(
        chartClient.GET("/jobs/{jobId}", {
          params: { path: { jobId }, query: { page, pageSize, since } },
          signal,
        }),
      ),
    ),

  /** 페이지 경계와 상관없이 offset 순번부터 count개 item의 상태를 long polling으로 받는다. */
  jobRange: (
    jobId: string,
    offset: number,
    count: number,
    since: number,
    signal?: AbortSignal,
  ) =>
    as<JobStateResponse>()(
      unwrap(
        chartClient.GET("/jobs/{jobId}", {
          params: {
            path: { jobId },
            query: { offset, pageSize: count, since },
          },
          signal,
        }),
      ),
    ),

  /** 지정한 item들의 상태를 long polling으로 받는다. */
  jobItems: (
    jobId: string,
    keys: string[],
    since: number,
    signal?: AbortSignal,
  ) =>
    as<JobStateResponse>()(
      unwrap(
        chartClient.GET("/jobs/{jobId}", {
          params: { path: { jobId }, query: { items: keys.join(","), since } },
          signal,
        }),
      ),
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
          params: { path: itemOfPng(pngUrl), query: sizeOfPng(pngUrl) },
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

  /** 선택 영역. null이면 선택 해제 */
  setSelection: (chartId: string, itemKey: string, region: Region | null) =>
    unwrap(
      chartClient.PUT("/charts/{chartId}/items/{itemKey}/selection", {
        params: { path: item(chartId, itemKey) },
        body: { region },
      }),
    ),

  /** 지금 선택 영역을 즐겨찾기에 이름 붙여 남긴다. */
  addFavorite: (chartId: string, itemKey: string, name: string) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/favorites", {
        params: { path: item(chartId, itemKey) },
        body: { name },
      }),
    ),

  removeFavorite: (chartId: string, itemKey: string, name: string) =>
    unwrap(
      chartClient.DELETE("/charts/{chartId}/items/{itemKey}/favorites/{name}", {
        params: { path: { ...item(chartId, itemKey), name } },
      }),
    ),

  /** 지금 선택 영역을 새 범례로 만든다. */
  addLegendGroup: (chartId: string, itemKey: string, name: string) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/legend-groups", {
        params: { path: item(chartId, itemKey) },
        body: { name },
      }),
    ),

  removeLegendGroup: (chartId: string, itemKey: string, name: string) =>
    unwrap(
      chartClient.DELETE(
        "/charts/{chartId}/items/{itemKey}/legend-groups/{name}",
        { params: { path: { ...item(chartId, itemKey), name } } },
      ),
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

  /** 크게 보기용 PNG. 그 크기로 그려 둔 게 있으면 image, 없으면 그리는 job이 온다. */
  itemDetail: (chartId: string, itemKey: string, itemSize: ItemSize) =>
    unwrap(
      chartClient.POST("/charts/{chartId}/items/{itemKey}/detail", {
        params: { path: item(chartId, itemKey) },
        body: { itemSize },
      }),
    ),

  setItemLegendPosition: (
    chartId: string,
    itemKey: string,
    legendPosition: LegendPosition | null,
  ) =>
    unwrap(
      chartClient.PATCH("/charts/{chartId}/items/{itemKey}/props", {
        params: { path: item(chartId, itemKey) },
        body: { legendPosition },
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
