import { HttpResponse, http } from "msw";
import { createChart } from "../charts/chart-store";
import { COLUMNS, DATASET_ID, isRowSize, type RowSize } from "../data/schema";
import {
  cancelJob,
  getJob,
  jobState,
  startJob,
  waitForUpdate,
} from "../jobs/job-manager";
import { matchPng, putPng } from "../png-store";
import { getRuntime } from "../runtime";
import type {
  ColumnsResponse,
  DatasetListResponse,
  DatasetStatus,
  DebugRenderRequest,
  DebugRenderResponse,
  GenerateDatasetRequest,
  HealthResponse,
} from "./types";
import {
  type ApiError,
  CHART_TYPES,
  type CreateChartRequest,
  type CreateChartResponse,
  type JobStateResponse,
} from "./types";

let pngVersion = 0;

/** 어떤 handler의 응답 타입에도 섞어 쓸 수 있도록 body 타입을 never로 둔다. */
function apiError(status: number, error: string) {
  return HttpResponse.json<ApiError>(
    { error },
    { status },
  ) as HttpResponse<never>;
}

function parseRows(value: unknown): RowSize | undefined {
  const n = Number(value);
  return isRowSize(n) ? n : undefined;
}

const dataset = (path: string) => `/api/datasets/:datasetId${path}`;

const COLUMN_TYPE = new Map<string, string>(
  COLUMNS.map((c) => [c.name, c.type]),
);
const IMPLEMENTED_CHART_TYPES = new Set(["scatter"]);
const MAX_ITEM_PX = 2000;
const LONG_POLL_TIMEOUT_MS = 25_000;

function validateChartRequest(body: CreateChartRequest): string | undefined {
  const { spec, itemSize } = body;
  if (!spec || !itemSize) return "spec and itemSize are required";
  if (!isRowSize(spec.rows)) return "rows must be one of the supported sizes";
  if (!CHART_TYPES.includes(spec.chartType)) return "unknown chartType";
  if (!IMPLEMENTED_CHART_TYPES.has(spec.chartType))
    return `${spec.chartType} is not implemented yet`;
  for (const axis of [spec.x, spec.y]) {
    const type = COLUMN_TYPE.get(axis);
    if (type !== "number" && type !== "time")
      return `${axis} cannot be a scatter axis`;
  }
  if (spec.splitBy.some((c) => !COLUMN_TYPE.has(c)))
    return "unknown splitBy column";
  const { width, height } = itemSize;
  if (
    !(
      width >= 50 &&
      height >= 50 &&
      width <= MAX_ITEM_PX &&
      height <= MAX_ITEM_PX
    )
  ) {
    return "itemSize out of range";
  }
}

export const handlers = [
  http.get("/api/health", async () => {
    const { db, render } = getRuntime();
    const info = await db.call("ping", undefined);
    return HttpResponse.json<HealthResponse>({
      db: info,
      renderWorkers: render.size,
    });
  }),

  http.get(dataset(""), async ({ params }) => {
    if (params.datasetId !== DATASET_ID)
      return apiError(404, "unknown dataset");
    const datasets = await getRuntime().db.call("datasetStatuses", undefined);
    return HttpResponse.json<DatasetListResponse>({ datasets });
  }),

  // 행 수를 고르면 그 규모의 데이터를 만든다. 이미 있거나 만드는 중이면 현재 상태만 돌려준다.
  http.post(dataset("/generate"), async ({ params, request }) => {
    if (params.datasetId !== DATASET_ID)
      return apiError(404, "unknown dataset");
    const body = (await request.json()) as GenerateDatasetRequest;
    const rows = parseRows(body.rows);
    if (!rows) return apiError(400, "rows must be one of the supported sizes");
    const status = await getRuntime().db.call("ensureDataset", { rows });
    return HttpResponse.json<DatasetStatus>(status, { status: 202 });
  }),

  http.get(dataset("/columns"), async ({ params, request }) => {
    if (params.datasetId !== DATASET_ID)
      return apiError(404, "unknown dataset");
    const rows = parseRows(new URL(request.url).searchParams.get("rows"));
    if (!rows) return apiError(400, "rows must be one of the supported sizes");
    const columns = await getRuntime().db.call("datasetColumns", { rows });
    if (!columns) return apiError(409, "dataset is not ready");
    return HttpResponse.json<ColumnsResponse>({ rows, columns });
  }),

  // 그리기 시작. 데이터가 아직 없어도 받아 두고 job이 init 상태로 기다린다.
  http.post("/api/charts", async ({ request }) => {
    const body = (await request.json()) as CreateChartRequest;
    const invalid = validateChartRequest(body);
    if (invalid) return apiError(400, invalid);
    const chart = createChart(body.spec, {
      width: Math.round(body.itemSize.width),
      height: Math.round(body.itemSize.height),
    });
    const job = startJob(chart);
    return HttpResponse.json<CreateChartResponse>(
      { chartId: chart.id, jobId: job.id },
      { status: 202 },
    );
  }),

  // long polling: since 이후 변화가 있거나 요청한 페이지가 모두 끝난 상태면 응답한다.
  http.get("/api/jobs/:jobId", async ({ params, request }) => {
    const job = getJob(String(params.jobId));
    if (!job) return apiError(404, "unknown job");
    const search = new URL(request.url).searchParams;
    const page = Math.max(0, Number(search.get("page") ?? 0) | 0);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(search.get("pageSize") ?? 9) | 0),
    );
    const since = Number(search.get("since") ?? -1);
    await waitForUpdate(job, since, page, pageSize, LONG_POLL_TIMEOUT_MS);
    return HttpResponse.json<JobStateResponse>(jobState(job, page, pageSize));
  }),

  http.post("/api/jobs/:jobId/cancel", ({ params }) => {
    const job = getJob(String(params.jobId));
    if (!job) return apiError(404, "unknown job");
    cancelJob(job);
    return new HttpResponse(null, { status: 202 });
  }),

  // 1단계 검증용 렌더. 이후 job 모델(`POST /api/charts`)로 대체한다.
  http.post("/api/debug/render", async ({ request }) => {
    const body = (await request.json()) as DebugRenderRequest;
    const { render } = getRuntime();
    const result = await render.call("renderTest", {
      width: body.width,
      height: body.height,
      label: body.itemKey,
      points: body.points,
    });
    const url = `/api/charts/${encodeURIComponent(body.chartId)}/items/${encodeURIComponent(body.itemKey)}/png?v=${++pngVersion}`;
    await putPng(new URL(url, location.origin).href, result.png);
    return HttpResponse.json<DebugRenderResponse>({
      url,
      width: body.width,
      height: body.height,
      worker: result.worker,
      renderMs: result.ms,
    });
  }),

  // `<img src>` 요청도 service worker를 거쳐 여기로 온다.
  http.get("/api/charts/:chartId/items/:itemKey/png", async ({ request }) => {
    const cached = await matchPng(request.url);
    if (!cached) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(await cached.arrayBuffer(), {
      headers: { "content-type": "image/png" },
    });
  }),
];
