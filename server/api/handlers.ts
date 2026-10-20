import { HttpResponse, http } from "msw";
import { DATASET_ID, isRowSize, type RowSize } from "../data/schema";
import { matchPng, putPng } from "../png-store";
import { getRuntime } from "../runtime";
import type {
  ApiError,
  ColumnsResponse,
  DatasetListResponse,
  DatasetStatus,
  DebugRenderRequest,
  DebugRenderResponse,
  GenerateDatasetRequest,
  HealthResponse,
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
