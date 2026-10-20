// mock 서버 REST API 클라이언트. 화면은 이 함수들로만 서버와 통신한다.

import type {
  ApiError,
  ColumnsResponse,
  CreateChartRequest,
  CreateChartResponse,
  DatasetListResponse,
  DatasetStatus,
  GenerateDatasetRequest,
  HealthResponse,
  JobStateResponse,
} from "@/server/api/types";
import { DATASET_ID, type RowSize } from "@/server/data/schema";

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

  job: (jobId: string, page: number, pageSize: number) =>
    request<JobStateResponse>(
      `/api/jobs/${jobId}?page=${page}&pageSize=${pageSize}`,
    ),

  columns: (rows: RowSize) =>
    request<ColumnsResponse>(
      `/api/datasets/${DATASET_ID}/columns?rows=${rows}`,
    ),
};
