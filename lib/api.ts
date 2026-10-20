// mock 서버 REST API 클라이언트. 화면은 이 함수들로만 서버와 통신한다.

import type {
  AddShapeRequest,
  ApiError,
  ColumnsResponse,
  CreateChartRequest,
  CreateChartResponse,
  DatasetListResponse,
  DatasetStatus,
  GenerateDatasetRequest,
  HealthResponse,
  ItemJobResponse,
  ItemMeta,
  JobStateResponse,
  SplitCountResponse,
  TooltipRequest,
  TooltipResponse,
  ViewRequest,
} from "@/server/api/types";
import {
  type ColumnName,
  DATASET_ID,
  type RowSize,
} from "@/server/data/schema";

function itemPath(chartId: string, itemKey: string, path: string) {
  return `/api/charts/${encodeURIComponent(chartId)}/items/${encodeURIComponent(itemKey)}${path}`;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),

  datasets: () => request<DatasetListResponse>(`/api/datasets/${DATASET_ID}`),

  generateDataset: (rows: RowSize) =>
    request<DatasetStatus>(`/api/datasets/${DATASET_ID}/generate`, {
      method: "POST",
      body: JSON.stringify({ rows } satisfies GenerateDatasetRequest),
    }),

  createChart: (body: CreateChartRequest) =>
    request<CreateChartResponse>("/api/charts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** long polling. since 이후 변화가 생기거나 페이지가 모두 끝나면 응답이 온다. */
  job: (
    jobId: string,
    page: number,
    pageSize: number,
    since: number,
    signal?: AbortSignal,
  ) =>
    request<JobStateResponse>(
      `/api/jobs/${jobId}?page=${page}&pageSize=${pageSize}&since=${since}`,
      { signal },
    ),

  cancelJob: (jobId: string) =>
    fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" }).then((res) => {
      if (!res.ok) throw new ApiRequestError(res.status, `HTTP ${res.status}`);
    }),

  /** PNG URL과 같은 버전의 metadata */
  itemMeta: (pngUrl: string) =>
    request<ItemMeta>(pngUrl.replace("/png?", "/meta?")),

  tooltip: (chartId: string, itemKey: string, body: TooltipRequest) =>
    request<TooltipResponse>(
      `/api/charts/${encodeURIComponent(chartId)}/items/${encodeURIComponent(itemKey)}/tooltip`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  changeView: (chartId: string, itemKey: string, body: ViewRequest) =>
    request<ItemJobResponse>(itemPath(chartId, itemKey, "/view"), {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addShape: (chartId: string, itemKey: string, body: AddShapeRequest) =>
    request<ItemJobResponse>(itemPath(chartId, itemKey, "/shapes"), {
      method: "POST",
      body: JSON.stringify(body),
    }),

  undoShape: (chartId: string, itemKey: string) =>
    request<ItemJobResponse>(itemPath(chartId, itemKey, "/shapes/last"), {
      method: "DELETE",
    }),

  clearShapes: (chartId: string, itemKey: string) =>
    request<ItemJobResponse>(itemPath(chartId, itemKey, "/shapes"), {
      method: "DELETE",
    }),

  splitCount: (rows: RowSize, cols: ColumnName[]) =>
    request<SplitCountResponse>(
      `/api/datasets/${DATASET_ID}/split-count?rows=${rows}&cols=${cols.join(",")}`,
    ),

  columns: (rows: RowSize) =>
    request<ColumnsResponse>(
      `/api/datasets/${DATASET_ID}/columns?rows=${rows}`,
    ),
};
