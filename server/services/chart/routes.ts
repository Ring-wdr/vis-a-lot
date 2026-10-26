// chart 서비스 API 정의: 그리기 job, item 조작(확대·도형·색), 툴팁, PNG, history, 공유.

import { createRoute, z } from "@hono/zod-openapi";
import { BEARER, requireAuth } from "../common/auth";
import { errorResponse, jsonBody, jsonResponse } from "../common/http";
import {
  AddShapeRequestSchema,
  ChartDefaultsSchema,
  ChartHealthSchema,
  CommonPropsRequestSchema,
  CreateChartRequestSchema,
  CreateChartResponseSchema,
  CreateShareRequestSchema,
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
  ResizeRequestSchema,
  SampleRowsResponseSchema,
  SelectionRequestSchema,
  ShareListResponseSchema,
  ShareSchema,
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
  summary: "공통 속성. 개별 속성을 모두 덮어쓰고 전체를 다시 그린다",
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
  .regex(/^\d+x\d+(@\d+(\.\d+)?)?(~dark)?$/)
  .optional()
  .openapi({
    description:
      "크게 보기 PNG의 크기 (WxH, 고해상도면 WxH@배율, 다크 테마면 뒤에 ~dark)",
  });

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

/** 화면 밖으로 내보내는 PNG. 화면 테마와 상관없이 light로 그린다. */
export const exportPng = createRoute({
  method: "post",
  path: "/charts/{chartId}/items/{itemKey}/png/export",
  tags: ["items"],
  summary:
    "내려받기·엑셀용 PNG (항상 light 테마). 화면이 다른 테마로 그렸으면 같은 크기로 한 장 더 그린다",
  ...read,
  request: { params: ItemParams },
  responses: {
    200: {
      description: "PNG",
      content: {
        "image/png": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    ...authErrors,
    404: errorResponse("모르는 item"),
    ...conflict("아직 그려지지 않음"),
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

export const deleteHistory = createRoute({
  method: "delete",
  path: "/history/{id}",
  tags: ["history"],
  summary: "history 한 건 지우기. 그 건에 기록 중인 차트는 더 기록하지 않는다",
  ...write,
  request: { params: z.object({ id: pathParam("id") }) },
  responses: {
    204: { description: "지움" },
    ...authErrors,
    404: errorResponse("모르는 history"),
  },
});

// ── 공유 ───────────────────────────────────────────────────────
// 다른 서비스(데이터 공유 피드 등)에 넘길 차트 스냅숏. 만든 뒤 차트를 고쳐도 공유는 바뀌지 않는다.

const ShareParams = z.object({ shareId: pathParam("shareId") });

export const createShare = createRoute({
  method: "post",
  path: "/shares",
  tags: ["shares"],
  summary: "차트의 지금 설정·item 상태와 대표 PNG를 공유로 고정",
  ...write,
  request: { body: jsonBody(CreateShareRequestSchema) },
  responses: {
    201: jsonResponse(ShareSchema, "만든 공유"),
    ...badRequest,
    ...authErrors,
    404: errorResponse("모르는 차트 또는 item"),
    ...conflict("대표로 쓸 item이 아직 그려지지 않음"),
  },
});

export const listShares = createRoute({
  method: "get",
  path: "/shares",
  tags: ["shares"],
  summary: "내가 만든 공유 목록 (최근 순)",
  ...read,
  responses: {
    200: jsonResponse(ShareListResponseSchema, "목록"),
    ...authErrors,
  },
});

export const getShare = createRoute({
  method: "get",
  path: "/shares/{shareId}",
  tags: ["shares"],
  summary: "공유 한 건",
  ...read,
  request: { params: ShareParams },
  responses: {
    200: jsonResponse(ShareSchema, "공유"),
    ...authErrors,
    404: errorResponse("모르는 공유"),
  },
});

/** item PNG와 같이 `<img src>`로 열도록 인증 없이 둔다. shareId는 추측할 수 없는 UUID다. */
export const sharePng = createRoute({
  method: "get",
  path: "/shares/{shareId}/png",
  tags: ["shares"],
  summary: "공유의 대표 PNG",
  request: { params: ShareParams },
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

export const deleteShare = createRoute({
  method: "delete",
  path: "/shares/{shareId}",
  tags: ["shares"],
  summary: "공유 지우기 (만든 사용자만)",
  ...write,
  request: { params: ShareParams },
  responses: {
    204: { description: "지움" },
    ...authErrors,
    404: errorResponse("모르는 공유이거나 만든 사용자가 아님"),
  },
});

// ── 운영 ───────────────────────────────────────────────────────

export const defaults = createRoute({
  method: "get",
  path: "/defaults",
  tags: ["charts"],
  summary: "차트 기본값 (전체 설정·draw가 함께 쓰는 속성 기본값)",
  ...read,
  responses: { 200: jsonResponse(ChartDefaultsSchema, "기본값") },
});

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
