// data 서비스 API 정의: 데이터셋 적재(생성)와 데이터셋 메타 조회.

import { createRoute, z } from "@hono/zod-openapi";
import { BEARER, requireAuth } from "../common/auth";
import { ColumnNameSchema, DatasetPathSchema } from "../common/dataset";
import { errorResponse, jsonBody, jsonResponse } from "../common/http";
import {
  ColumnSummarySchema,
  DataHealthSchema,
  DatasetListResponseSchema,
  DatasetSchemaResponseSchema,
  DatasetStatusSchema,
  EditDatasetRequestSchema,
  LegendValuesResponseSchema,
  SplitCountRequestSchema,
  SplitCountResponseSchema,
  UploadDatasetRequestSchema,
} from "./schemas";

const tags = ["datasets"];
const read = { security: BEARER, middleware: requireAuth("data:read") };
const write = { security: BEARER, middleware: requireAuth("data:write") };
const authErrors = {
  401: errorResponse("토큰 없음, 만료, 위조"),
  403: errorResponse("scope 부족"),
};
const notFound = { 404: errorResponse("모르는 데이터셋") };
const notReady = { 409: errorResponse("데이터셋이 아직 준비되지 않음") };
const badRequest = { 400: errorResponse("요청 형식 오류") };

const rejected = { 422: errorResponse("CSV 검사에서 거절 (스키마 불일치 등)") };

export const listDatasets = createRoute({
  method: "get",
  path: "/datasets",
  tags,
  summary: "샘플과 업로드한 데이터셋의 적재 상태",
  ...read,
  responses: {
    200: jsonResponse(DatasetListResponseSchema, "데이터셋 목록"),
    ...authErrors,
  },
});

export const datasetStatus = createRoute({
  method: "get",
  path: "/datasets/{datasetId}",
  tags,
  summary: "데이터셋 하나의 적재 상태",
  ...read,
  request: { params: DatasetPathSchema },
  responses: {
    200: jsonResponse(DatasetStatusSchema, "상태"),
    ...badRequest,
    ...authErrors,
    ...notFound,
  },
});

export const generateDataset = createRoute({
  method: "post",
  path: "/datasets/{datasetId}/generate",
  tags,
  summary:
    "샘플 데이터 적재(등록). 이미 있거나 만드는 중이면 현재 상태만 돌려준다. 업로드한 데이터셋은 상태만 돌려준다",
  ...write,
  request: { params: DatasetPathSchema },
  responses: {
    202: jsonResponse(DatasetStatusSchema, "현재 상태"),
    ...badRequest,
    ...authErrors,
    ...notFound,
  },
});

export const uploadDataset = createRoute({
  method: "post",
  path: "/datasets/uploads",
  tags,
  summary:
    "CSV 또는 zip(CSV 여러 개를 하나로 합침) 업로드. 파일마다 스키마가 다르면 거절한다",
  ...write,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": { schema: UploadDatasetRequestSchema },
      },
    },
  },
  responses: {
    202: jsonResponse(DatasetStatusSchema, "적재 시작"),
    ...badRequest,
    ...authErrors,
    ...rejected,
  },
});

export const editDataset = createRoute({
  method: "patch",
  path: "/datasets/{datasetId}",
  tags,
  summary:
    "업로드한 데이터셋의 이름·전처리 옵션 변경. 옵션을 바꾸면 원본으로 다시 검사·적재한다",
  ...write,
  request: {
    params: DatasetPathSchema,
    body: jsonBody(EditDatasetRequestSchema),
  },
  responses: {
    200: jsonResponse(DatasetStatusSchema, "바뀐 상태"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    ...rejected,
  },
});

export const deleteDataset = createRoute({
  method: "delete",
  path: "/datasets/{datasetId}",
  tags,
  summary: "업로드한 데이터셋 삭제",
  ...write,
  request: { params: DatasetPathSchema },
  responses: {
    204: { description: "삭제됨" },
    ...badRequest,
    ...authErrors,
    ...notFound,
    409: errorResponse("적재 중이라 지울 수 없음"),
  },
});

export const schema = createRoute({
  method: "get",
  path: "/datasets/{datasetId}/schema",
  tags,
  summary:
    "데이터셋 스키마: 적재된 테이블에서 읽은 컬럼과 타입(categorical / numeric / datetime). 적재 중에도 알 수 있다",
  ...read,
  request: {
    params: DatasetPathSchema,
  },
  responses: {
    200: jsonResponse(DatasetSchemaResponseSchema, "컬럼 목록"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    409: errorResponse("등록하지 않은 데이터셋"),
  },
});

export const splitCount = createRoute({
  method: "post",
  path: "/datasets/{datasetId}/split-count",
  tags,
  summary:
    "split 조합 개수 (최대 개수 초과 검사). 필터가 있으면 필터를 적용해 센다",
  ...read,
  request: {
    params: DatasetPathSchema,
    body: jsonBody(SplitCountRequestSchema),
  },
  responses: {
    200: jsonResponse(SplitCountResponseSchema, "조합 개수"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    ...notReady,
  },
});

export const columnSummary = createRoute({
  method: "get",
  path: "/datasets/{datasetId}/columns/{column}/summary",
  tags,
  summary: "필터용 컬럼 요약: 숫자·시계열은 범위와 null 수, 범주는 값별 행 수",
  ...read,
  request: {
    params: DatasetPathSchema.extend({
      column: ColumnNameSchema.openapi({
        param: { name: "column", in: "path" },
      }),
    }),
  },
  responses: {
    200: jsonResponse(ColumnSummarySchema, "컬럼 요약"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    ...notReady,
  },
});

export const legendValues = createRoute({
  method: "get",
  path: "/datasets/{datasetId}/legend-values",
  tags,
  summary: "legend 컬럼의 전체 값 목록",
  ...read,
  request: {
    params: DatasetPathSchema,
    query: z.object({
      column: ColumnNameSchema.openapi({
        param: { name: "column", in: "query" },
      }),
    }),
  },
  responses: {
    200: jsonResponse(LegendValuesResponseSchema, "legend 값"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    ...notReady,
  },
});

export const health = createRoute({
  method: "get",
  path: "/health",
  tags: ["ops"],
  responses: { 200: jsonResponse(DataHealthSchema, "상태") },
});
