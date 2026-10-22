// chart 서비스 API 정의: 그리기 job, item 조작(확대·도형·색), 툴팁, PNG, history.

import { createRoute, z } from "@hono/zod-openapi";
import { BEARER, requireAuth } from "../common/auth";
import { errorResponse, jsonBody, jsonResponse } from "../common/http";
import {
  AddShapeRequestSchema,
  ChartHealthSchema,
  CommonPropsRequestSchema,
  CreateChartRequestSchema,
  CreateChartResponseSchema,
  DebugRenderRequestSchema,
  DebugRenderResponseSchema,
  DeletionRequestSchema,
  DetailRequestSchema,
  DetailResponseSchema,
  GridRequestSchema,
  HistoryDetailSchema,
  HistoryListResponseSchema,
  ItemJobResponseSchema,
  ItemMetaSchema,
  ItemPropsRequestSchema,
  ItemRowsRequestSchema,
  ItemRowsResponseSchema,
  JobQuerySchema,
  JobStateResponseSchema,
  NameRequestSchema,
  RefreshRequestSchema,
  ResizeRequestSchema,
  SampleRowsResponseSchema,
  SelectionRequestSchema,
  TooltipRequestSchema,
  TooltipResponseSchema,
  ViewRequestSchema,
} from "./schemas";

const read = { security: BEARER, middleware: requireAuth("chart:read") };
const write = { security: BEARER, middleware: requireAuth("chart:write") };
const authErrors = {
  401: errorResponse("토큰 없음, 만료, 위조"),
  403: errorResponse("scope 부족"),
};
const badRequest = { 400: errorResponse("요청 형식 오류") };
const conflict = (why: string) => ({ 409: errorResponse(why) });
const accepted = jsonResponse(
  ItemJobResponseSchema,
  "다시 그리는 job. long polling으로 진행 상태를 받는다",
);

const pathParam = (name: string) =>
  z.string().openapi({ param: { name, in: "path" } });
const ChartParams = z.object({ chartId: pathParam("chartId") });
const ItemParams = z.object({
  chartId: pathParam("chartId"),
  itemKey: pathParam("itemKey"),
});
const JobParams = z.object({ jobId: pathParam("jobId") });

// ── 그리기 job ─────────────────────────────────────────────────

export const createChart = createRoute({
  method: "post",
  path: "/charts",
  tags: ["charts"],
  summary:
    "그리기 시작. 데이터가 아직 없어도 받아 두고 job이 init 상태로 기다린다",
  ...write,
  request: { body: jsonBody(CreateChartRequestSchema) },
  responses: {
    202: jsonResponse(CreateChartResponseSchema, "차트와 job id"),
    ...badRequest,
    ...authErrors,
  },
});

export const jobState = createRoute({
  method: "get",
  path: "/jobs/{jobId}",
  tags: ["jobs"],
  summary:
    "long polling. since 이후 변화가 있거나 요청한 페이지가 모두 끝나면 응답한다. pageSize=0이면 job 전체 진행 상태만",
  ...read,
  request: { params: JobParams, query: JobQuerySchema },
  responses: {
    200: jsonResponse(JobStateResponseSchema, "job 상태"),
    ...badRequest,
    ...authErrors,
    404: errorResponse("모르는 job"),
  },
});

export const cancelJob = createRoute({
  method: "post",
  path: "/jobs/{jobId}/cancel",
  tags: ["jobs"],
  summary: "남은 item을 cancelled로 기록하고 멈춘다",
  ...write,
  request: { params: JobParams },
  responses: {
    202: { description: "취소 요청됨" },
    ...authErrors,
    404: errorResponse("모르는 job"),
  },
});

// ── item 조작 ──────────────────────────────────────────────────

const itemErrors = {
  ...badRequest,
  ...authErrors,
  404: errorResponse("모르는 item"),
  ...conflict("아직 그려지지 않았거나 다시 그리는 중"),
};

export const changeView = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/view",
  tags: ["items"],
  summary: "확대 / 축소 / 초기화 / 이동. 바뀐 범위로 그 item만 다시 그린다",
  ...write,
  request: { params: ItemParams, body: jsonBody(ViewRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

export const addShape = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/shapes",
  tags: ["items"],
  summary: "도형 추가 (데이터 좌표)",
  ...write,
  request: { params: ItemParams, body: jsonBody(AddShapeRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

export const undoShape = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/shapes/last",
  tags: ["items"],
  summary: "마지막 도형 빼기 (undo)",
  ...write,
  request: { params: ItemParams },
  responses: { 202: accepted, ...itemErrors },
});

export const clearShapes = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/shapes",
  tags: ["items"],
  summary: "도형 전체 삭제",
  ...write,
  request: { params: ItemParams },
  responses: { 202: accepted, ...itemErrors },
});

export const addDeletion = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/deletions",
  tags: ["items"],
  summary:
    "영역 안의 점 지우기 (scatter만). 데이터는 그대로 두고 그 item에서만 뺀다",
  ...write,
  request: { params: ItemParams, body: jsonBody(DeletionRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

export const undoDeletion = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/deletions/last",
  tags: ["items"],
  summary: "마지막으로 지운 영역 되돌리기",
  ...write,
  request: { params: ItemParams },
  responses: { 202: accepted, ...itemErrors },
});

export const clearDeletions = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/deletions",
  tags: ["items"],
  summary: "지운 점 모두 되돌리기",
  ...write,
  request: { params: ItemParams },
  responses: { 202: accepted, ...itemErrors },
});

export const setSelection = createRoute({
  method: "put",
  path: "/charts/{chartId}/items/{itemKey}/selection",
  tags: ["items"],
  summary: "선택 영역 (데이터 좌표). null이면 선택 해제",
  ...write,
  request: { params: ItemParams, body: jsonBody(SelectionRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

const NamedParams = ItemParams.extend({ name: pathParam("name") });

export const addFavorite = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/favorites",
  tags: ["items"],
  summary: "지금 선택 영역을 이름 붙여 즐겨찾기에 추가",
  ...write,
  request: { params: ItemParams, body: jsonBody(NameRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

export const removeFavorite = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/favorites/{name}",
  tags: ["items"],
  summary: "즐겨찾기 삭제",
  ...write,
  request: { params: NamedParams },
  responses: { 202: accepted, ...itemErrors },
});

export const addLegendGroup = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/legend-groups",
  tags: ["items"],
  summary:
    "지금 선택 영역을 새 범례로. 영역 안의 점을 새 legend 항목 색으로 칠하고 선택은 푼다",
  ...write,
  request: { params: ItemParams, body: jsonBody(NameRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

export const removeLegendGroup = createRoute({
  method: "delete",
  path: "/charts/{chartId}/items/{itemKey}/legend-groups/{name}",
  tags: ["items"],
  summary: "새 범례 삭제",
  ...write,
  request: { params: NamedParams },
  responses: { 202: accepted, ...itemErrors },
});

export const changeItemProps = createRoute({
  method: "patch",
  path: "/charts/{chartId}/items/{itemKey}/props",
  tags: ["items"],
  summary: "item 개별 색 (null이면 공통 속성을 따름)",
  ...write,
  request: { params: ItemParams, body: jsonBody(ItemPropsRequestSchema) },
  responses: { 202: accepted, ...itemErrors },
});

// ── 차트 전체 ──────────────────────────────────────────────────

const chartErrors = {
  ...badRequest,
  ...authErrors,
  404: errorResponse("모르는 차트"),
  ...conflict("렌더링 중"),
};

export const changeCommon = createRoute({
  method: "patch",
  path: "/charts/{chartId}/common",
  tags: ["charts"],
  summary:
    "공통 속성. 개별 속성을 모두 덮어쓰고, visible 범위는 바로, 나머지는 볼 때(refresh) 다시 그린다",
  ...write,
  request: { params: ChartParams, body: jsonBody(CommonPropsRequestSchema) },
  responses: { 202: accepted, ...chartErrors },
});

export const changeGrid = createRoute({
  method: "patch",
  path: "/charts/{chartId}/grid",
  tags: ["charts"],
  summary: "grid 크기. item 크기가 바뀌므로 전체를 다시 그린다",
  ...write,
  request: { params: ChartParams, body: jsonBody(GridRequestSchema) },
  responses: { 202: accepted, ...chartErrors },
});

export const resize = createRoute({
  method: "post",
  path: "/charts/{chartId}/resize",
  tags: ["charts"],
  summary:
    "화면 크기 변경. 요청한 item만 새 크기로 다시 그린다 (history에 남기지 않음)",
  ...read,
  request: { params: ChartParams, body: jsonBody(ResizeRequestSchema) },
  responses: { 202: accepted, ...chartErrors },
});

export const refreshItems = createRoute({
  method: "post",
  path: "/charts/{chartId}/refresh",
  tags: ["charts"],
  summary:
    "공통 속성이 바뀐 뒤 아직 다시 그리지 않은(stale) item을 다시 그린다. 화면이 그 페이지를 볼 때 부른다",
  ...read,
  request: { params: ChartParams, body: jsonBody(RefreshRequestSchema) },
  responses: { 202: accepted, ...chartErrors },
});

// ── 크게 보기 ──────────────────────────────────────────────────

export const itemDetail = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/detail",
  tags: ["items"],
  summary:
    "크게 보기용 PNG. 같은 내용·같은 크기로 그려 둔 게 있으면 바로 주고, 없으면 그 한 장만 그리는 job을 준다",
  ...read,
  request: { params: ItemParams, body: jsonBody(DetailRequestSchema) },
  responses: {
    200: jsonResponse(DetailResponseSchema, "그려 둔 PNG 또는 그리는 job"),
    ...itemErrors,
  },
});

// ── 툴팁 ───────────────────────────────────────────────────────

/** 크게 보기 PNG의 크기 ("WxH"). 없으면 grid PNG의 metadata다. */
const SizeQuerySchema = z
  .string()
  .regex(/^\d+x\d+$/)
  .optional()
  .openapi({ description: "크게 보기 PNG의 크기 (WxH)" });

export const itemMeta = createRoute({
  method: "get",
  path: "/charts/{chartId}/items/{itemKey}/meta",
  tags: ["tooltip"],
  summary: "툴팁용 metadata (축 정보 + 픽셀 기준으로 줄인 점)",
  ...read,
  request: { params: ItemParams, query: z.object({ size: SizeQuerySchema }) },
  responses: {
    200: jsonResponse(ItemMetaSchema, "metadata"),
    ...authErrors,
    404: errorResponse("metadata가 아직 없음"),
  },
});

export const tooltip = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/tooltip",
  tags: ["tooltip"],
  summary: "x, y 외의 툴팁 컬럼을 행 식별자로 조회",
  ...read,
  request: { params: ItemParams, body: jsonBody(TooltipRequestSchema) },
  responses: {
    200: jsonResponse(TooltipResponseSchema, "컬럼 값"),
    ...badRequest,
    ...authErrors,
    404: errorResponse("모르는 차트, 또는 지운 데이터셋"),
  },
});

// ── 데이터 표 / 다운로드 ───────────────────────────────────────

const rowsErrors = {
  ...badRequest,
  ...authErrors,
  404: errorResponse("모르는 item, 또는 지운 데이터셋"),
  ...conflict("아직 그려지지 않음"),
};

export const itemRows = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/rows",
  tags: ["data"],
  summary:
    "item이 그린 행 한 페이지 (모든 컬럼, draw 시점 필터). 선택 필드 차트는 선택 영역이 있으면 그 안의 행만, 지운 점은 뺀다",
  ...read,
  request: { params: ItemParams, body: jsonBody(ItemRowsRequestSchema) },
  responses: {
    200: jsonResponse(ItemRowsResponseSchema, "행"),
    ...rowsErrors,
  },
});

export const sampleRows = createRoute({
  method: "post",
  path: "/charts/{chartId}/rows",
  tags: ["data"],
  summary:
    "전체 데이터 표 한 페이지: 데이터셋 전체를 draw 시점 필터로 거른 뒤 최대 30,000행 샘플 (모든 컬럼)",
  ...read,
  request: { params: ChartParams, body: jsonBody(ItemRowsRequestSchema) },
  responses: {
    200: jsonResponse(SampleRowsResponseSchema, "샘플 행"),
    ...badRequest,
    ...authErrors,
    404: errorResponse("모르는 차트, 또는 지운 데이터셋"),
  },
});

export const exportItemRows = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/rows/export",
  tags: ["data"],
  summary: "item이 그린 행 전체를 CSV로 (데이터 표와 같은 조건, 모든 컬럼)",
  ...read,
  request: { params: ItemParams },
  responses: {
    200: {
      description: "CSV (머리글은 컬럼 라벨)",
      content: { "text/csv": { schema: z.string() } },
    },
    ...rowsErrors,
  },
});

/**
 * `<img src>`는 Authorization 헤더를 보낼 수 없어 인증 없이 연다.
 * chartId가 추측할 수 없는 UUID라 링크를 아는 사람만 볼 수 있다 (presigned URL과 같은 성격).
 */
export const png = createRoute({
  method: "get",
  path: "/charts/{chartId}/items/{itemKey}/png",
  tags: ["items"],
  summary: "렌더된 PNG",
  request: {
    params: ItemParams,
    // v: grid PNG 버전, r: 내용 revision, size: 섬네일(thumb) 또는 크게 보기 크기
    query: z.object({
      v: z.string().optional(),
      r: z.string().optional(),
      size: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "PNG",
      content: {
        "image/png": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    404: { description: "없음" },
  },
});

// ── history ────────────────────────────────────────────────────

export const historyList = createRoute({
  method: "get",
  path: "/history",
  tags: ["history"],
  summary: "그린 차트 목록 (최근 순)",
  ...read,
  responses: {
    200: jsonResponse(HistoryListResponseSchema, "목록"),
    ...authErrors,
  },
});

export const historyDetail = createRoute({
  method: "get",
  path: "/history/{id}",
  tags: ["history"],
  summary: "설정과 item별 상태",
  ...read,
  request: { params: z.object({ id: pathParam("id") }) },
  responses: {
    200: jsonResponse(HistoryDetailSchema, "history 한 건"),
    ...authErrors,
    404: errorResponse("모르는 history"),
  },
});

// ── 운영 ───────────────────────────────────────────────────────

export const health = createRoute({
  method: "get",
  path: "/health",
  tags: ["ops"],
  responses: { 200: jsonResponse(ChartHealthSchema, "상태") },
});

export const debugRender = createRoute({
  method: "post",
  path: "/debug/render",
  tags: ["ops"],
  summary: "구조 검증용 렌더 (/dev 페이지)",
  ...read,
  request: { body: jsonBody(DebugRenderRequestSchema) },
  responses: {
    200: jsonResponse(DebugRenderResponseSchema, "렌더 결과"),
    ...badRequest,
    ...authErrors,
  },
});
