import { HttpResponse, http } from "msw";
import { createChart, getChart, getItem } from "../charts/chart-store";
import { zoomIn, zoomOut } from "../charts/item-view";
import {
  AGG_FNS,
  COLUMNS,
  type ColumnName,
  DATASET_ID,
  isRowSize,
  MAX_SPLIT_ITEMS,
  type RowSize,
} from "../data/schema";
import {
  cancelJob,
  getJob,
  type ItemSelection,
  jobState,
  startItemJob,
  startJob,
  waitForUpdate,
} from "../jobs/job-manager";
import { matchPng, putPng } from "../png-store";
import { isValidShape } from "../render/shapes";
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
  type AddShapeRequest,
  type ApiError,
  CHART_TYPES,
  type CommonPropsRequest,
  type CreateChartRequest,
  type CreateChartResponse,
  type GridRequest,
  type ItemJobResponse,
  type ItemMeta,
  type ItemPropsRequest,
  isHexColor,
  isTerminal,
  type JobStateResponse,
  type ResizeRequest,
  type SplitCountResponse,
  type TooltipRequest,
  type TooltipResponse,
  type ViewRequest,
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

const itemPath = (path: string) => `/api/charts/:chartId/items/:itemKey${path}`;

type ItemParams = {
  chartId?: string | readonly string[];
  itemKey?: string | readonly string[];
};

/** item 단위 조작의 공통 전처리. 아직 그려지지 않았거나 다시 그리는 중이면 거절한다. */
function editableItem(params: ItemParams) {
  const chart = getChart(String(params.chartId));
  const item = chart && getItem(chart, String(params.itemKey));
  if (!chart || !item) return { error: apiError(404, "unknown item") } as const;
  if (!item.image)
    return { error: apiError(409, "item is not drawn yet") } as const;
  if (item.busyJobId)
    return { error: apiError(409, "item is being redrawn") } as const;
  return { chart, item } as const;
}

function redraw(chart: Parameters<typeof startItemJob>[0], key: string) {
  const job = startItemJob(chart, [key]);
  return HttpResponse.json<ItemJobResponse>({ jobId: job.id }, { status: 202 });
}

const ZOOM_OUT_MAX_RATIO = 10;

const COLUMN_TYPE = new Map<string, string>(
  COLUMNS.map((c) => [c.name, c.type]),
);
const MAX_ITEM_PX = 2000;
const LONG_POLL_TIMEOUT_MS = 25_000;

function validItemSize(
  size: unknown,
): size is { width: number; height: number } {
  const s = size as { width?: number; height?: number } | undefined;
  return (
    !!s &&
    Number.isFinite(s.width) &&
    Number.isFinite(s.height) &&
    (s.width as number) >= 50 &&
    (s.height as number) >= 50 &&
    (s.width as number) <= MAX_ITEM_PX &&
    (s.height as number) <= MAX_ITEM_PX
  );
}

function roundSize(size: { width: number; height: number }) {
  return { width: Math.round(size.width), height: Math.round(size.height) };
}

/** 전체를 다시 그리는 변경(공통 속성, grid)은 차트가 다 그려지고 쉬고 있을 때만 받는다. */
function idleChart(chartId: string) {
  const chart = getChart(chartId);
  if (!chart) return { error: apiError(404, "unknown chart") } as const;
  const primary = chart.primaryJobId ? getJob(chart.primaryJobId) : undefined;
  if (!chart.items || (primary && !isTerminal(primary.status))) {
    return { error: apiError(409, "렌더링 중에는 바꿀 수 없습니다.") } as const;
  }
  if (chart.items.some((i) => i.busyJobId)) {
    return {
      error: apiError(409, "다시 그리는 중인 item이 있습니다."),
    } as const;
  }
  return { chart, items: chart.items } as const;
}

function validateChartRequest(body: CreateChartRequest): string | undefined {
  const { spec, itemSize } = body;
  if (!spec || !itemSize) return "spec and itemSize are required";
  if (!isRowSize(spec.rows)) return "rows must be one of the supported sizes";
  if (!isHexColor(spec.common?.color)) return "invalid common color";
  if (!CHART_TYPES.includes(spec.chartType)) return "unknown chartType";
  if (spec.chartType === "scatter") {
    for (const axis of [spec.x, spec.y]) {
      const type = COLUMN_TYPE.get(axis);
      if (type !== "number" && type !== "time")
        return `${axis} cannot be a scatter axis`;
    }
  } else {
    // bar / boxplot: x는 범주(문자) 컬럼, y는 숫자 컬럼
    if (COLUMN_TYPE.get(spec.x) !== "string")
      return `${spec.x} is not categorical`;
    if (COLUMN_TYPE.get(spec.y) !== "number") return `${spec.y} is not numeric`;
    if (!AGG_FNS.includes(spec.agg)) return "unknown agg";
  }
  if (new Set(spec.splitBy).size !== spec.splitBy.length)
    return "duplicate splitBy column";
  if (typeof spec.splitSeparator !== "string" || spec.splitSeparator.length > 5)
    return "splitSeparator must be at most 5 characters";
  if (spec.tooltip.some((c) => !COLUMN_TYPE.has(c)))
    return "unknown tooltip column";
  if (spec.splitBy.some((c) => !COLUMN_TYPE.has(c)))
    return "unknown splitBy column";
  if (!validItemSize(itemSize)) return "itemSize out of range";
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

  http.get(dataset("/split-count"), async ({ params, request }) => {
    if (params.datasetId !== DATASET_ID)
      return apiError(404, "unknown dataset");
    const search = new URL(request.url).searchParams;
    const rows = parseRows(search.get("rows"));
    if (!rows) return apiError(400, "rows must be one of the supported sizes");
    const cols = (search.get("cols") ?? "").split(",").filter(Boolean);
    if (cols.some((c) => !COLUMN_TYPE.has(c)))
      return apiError(400, "unknown column");
    const ready = await getRuntime().db.call("datasetColumns", { rows });
    if (!ready) return apiError(409, "dataset is not ready");
    const result = await getRuntime().db.call("splitCount", {
      rows,
      cols: cols as ColumnName[],
      limit: MAX_SPLIT_ITEMS,
    });
    return HttpResponse.json<SplitCountResponse>({
      ...result,
      limit: MAX_SPLIT_ITEMS,
    });
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
  // pageSize=0이면 item 없이 job 전체 진행 상태만 주고, job이 끝날 때까지 이어진다.
  http.get("/api/jobs/:jobId", async ({ params, request }) => {
    const job = getJob(String(params.jobId));
    if (!job) return apiError(404, "unknown job");
    const search = new URL(request.url).searchParams;
    // items=k1,k2: 그 item들만 (item 단위 다시 그리기), 없으면 page/pageSize 단위
    const keys = search.get("items")?.split(",").filter(Boolean);
    const selection: ItemSelection = keys
      ? { keys }
      : {
          page: Math.max(0, Number(search.get("page") ?? 0) | 0),
          pageSize: Math.min(
            100,
            Math.max(0, Number(search.get("pageSize") ?? 9) | 0),
          ),
        };
    const since = Number(search.get("since") ?? -1);
    await waitForUpdate(job, since, selection, LONG_POLL_TIMEOUT_MS);
    return HttpResponse.json<JobStateResponse>(jobState(job, selection));
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

  // 확대/축소/초기화. 바뀐 범위로 그 item만 다시 그린다.
  http.post(itemPath("/view"), async ({ params, request }) => {
    const target = editableItem(params);
    if ("error" in target) return target.error;
    const { chart, item } = target;
    const body = (await request.json()) as ViewRequest;
    if (body.type === "zoomIn") {
      if (![...body.x, ...body.y].every(Number.isFinite))
        return apiError(400, "invalid range");
      const view = zoomIn(body.x, body.y);
      if (!view) return apiError(400, "empty range");
      item.view = view;
    } else if (body.type === "zoomOut") {
      if (!item.view) return apiError(409, "item is not zoomed");
      if (!(body.ratio > 1 && body.ratio <= ZOOM_OUT_MAX_RATIO))
        return apiError(400, "invalid ratio");
      item.view = zoomOut(item.view, item.fullView, body.ratio);
    } else if (body.type === "reset") {
      item.view = undefined;
    } else {
      return apiError(400, "unknown view action");
    }
    return redraw(chart, item.key);
  }),

  http.post(itemPath("/shapes"), async ({ params, request }) => {
    const target = editableItem(params);
    if ("error" in target) return target.error;
    const body = (await request.json()) as AddShapeRequest;
    if (!isValidShape(body.shape)) return apiError(400, "invalid shape");
    target.item.shapes.push(body.shape);
    return redraw(target.chart, target.item.key);
  }),

  // undo: 마지막 도형을 뺀다. undo 이력 자체는 화면 세션 안에서만 의미가 있다.
  http.delete(itemPath("/shapes/last"), ({ params }) => {
    const target = editableItem(params);
    if ("error" in target) return target.error;
    if (target.item.shapes.length === 0) return apiError(409, "no shapes");
    target.item.shapes.pop();
    return redraw(target.chart, target.item.key);
  }),

  http.delete(itemPath("/shapes"), ({ params }) => {
    const target = editableItem(params);
    if ("error" in target) return target.error;
    if (target.item.shapes.length === 0) return apiError(409, "no shapes");
    target.item.shapes = [];
    return redraw(target.chart, target.item.key);
  }),

  // 공통 속성 변경: 개별 속성을 모두 덮어쓰고, 다시 조회하지 않고 전체를 다시 그린다.
  http.patch("/api/charts/:chartId/common", async ({ params, request }) => {
    const body = (await request.json()) as CommonPropsRequest;
    if (!isHexColor(body.common?.color)) return apiError(400, "invalid color");
    const target = idleChart(String(params.chartId));
    if ("error" in target) return target.error;
    const { chart, items } = target;
    chart.spec = { ...chart.spec, common: { ...body.common } };
    for (const item of items) item.props = undefined;
    const job = startItemJob(
      chart,
      items.map((i) => i.key),
      { primary: true },
    );
    return HttpResponse.json<ItemJobResponse>(
      { jobId: job.id },
      { status: 202 },
    );
  }),

  // grid 크기 변경: item 크기가 바뀌므로 draw 없이 바로 전체를 다시 그린다.
  http.patch("/api/charts/:chartId/grid", async ({ params, request }) => {
    const body = (await request.json()) as GridRequest;
    const n = body.grid?.rows;
    if (!(Number.isInteger(n) && n >= 1 && n <= 10 && body.grid.cols === n)) {
      return apiError(400, "grid must be n x n (1..10)");
    }
    if (!validItemSize(body.itemSize))
      return apiError(400, "itemSize out of range");
    const target = idleChart(String(params.chartId));
    if ("error" in target) return target.error;
    const { chart, items } = target;
    chart.spec = { ...chart.spec, grid: { rows: n, cols: n } };
    chart.itemSize = roundSize(body.itemSize);
    const job = startItemJob(
      chart,
      items.map((i) => i.key),
      { primary: true },
    );
    return HttpResponse.json<ItemJobResponse>(
      { jobId: job.id },
      { status: 202 },
    );
  }),

  // 화면 크기 변경: 요청한 item(현재 페이지)만 새 크기로 다시 그린다. history에는 남기지 않는다.
  http.post("/api/charts/:chartId/resize", async ({ params, request }) => {
    const chart = getChart(String(params.chartId));
    if (!chart?.items) return apiError(404, "unknown chart");
    const body = (await request.json()) as ResizeRequest;
    if (!validItemSize(body.itemSize))
      return apiError(400, "itemSize out of range");
    const keys = new Set(body.keys);
    const targets = chart.items.filter(
      (i) => keys.has(i.key) && i.image && !i.busyJobId,
    );
    if (targets.length === 0) return apiError(409, "no item to resize");
    chart.itemSize = roundSize(body.itemSize);
    const job = startItemJob(
      chart,
      targets.map((i) => i.key),
    );
    return HttpResponse.json<ItemJobResponse>(
      { jobId: job.id },
      { status: 202 },
    );
  }),

  http.patch(itemPath("/props"), async ({ params, request }) => {
    const target = editableItem(params);
    if ("error" in target) return target.error;
    const body = (await request.json()) as ItemPropsRequest;
    if (body.color !== null && !isHexColor(body.color))
      return apiError(400, "invalid color");
    target.item.props = body.color === null ? undefined : { color: body.color };
    return redraw(target.chart, target.item.key);
  }),

  // 툴팁용 metadata. 화면이 item에 처음 커서를 올릴 때 받아 캐시한다.
  http.get("/api/charts/:chartId/items/:itemKey/meta", ({ params }) => {
    const item = getChart(String(params.chartId))?.items?.find(
      (i) => i.key === params.itemKey,
    );
    if (!item?.meta) return apiError(404, "metadata is not ready");
    return HttpResponse.json<ItemMeta>(item.meta);
  }),

  // x, y 외의 툴팁 컬럼은 행 식별자로 서버에서 조회한다.
  http.post(
    "/api/charts/:chartId/items/:itemKey/tooltip",
    async ({ params, request }) => {
      const chart = getChart(String(params.chartId));
      if (!chart) return apiError(404, "unknown chart");
      const body = (await request.json()) as TooltipRequest;
      if (!Number.isFinite(body.rowId))
        return apiError(400, "rowId is required");
      if (body.columns.some((c) => !COLUMN_TYPE.has(c)))
        return apiError(400, "unknown column");
      const values = await getRuntime().db.call("rowValues", {
        rows: chart.spec.rows,
        rowId: body.rowId,
        columns: body.columns,
      });
      return HttpResponse.json<TooltipResponse>({ values });
    },
  ),

  // `<img src>` 요청도 service worker를 거쳐 여기로 온다.
  http.get("/api/charts/:chartId/items/:itemKey/png", async ({ request }) => {
    const cached = await matchPng(request.url);
    if (!cached) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(await cached.arrayBuffer(), {
      headers: { "content-type": "image/png" },
    });
  }),
];
