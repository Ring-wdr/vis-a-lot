// data 서비스 API 정의: 데이터셋 적재(생성)와 데이터셋 메타 조회.

import { createRoute, z } from "@hono/zod-openapi";
import { BEARER, requireAuth } from "../common/auth";
import { ColumnNameSchema, DatasetPathSchema } from "../common/dataset";
import { errorResponse, jsonBody, jsonResponse } from "../common/http";
import {
  CheckUploadRequestSchema,
  ColumnSummarySchema,
  CommitUploadRequestSchema,
  CsvCheckSchema,
  CsvPreviewSchema,
  DataHealthSchema,
  DatasetListResponseSchema,
  DatasetSchemaResponseSchema,
  DatasetStatusSchema,
  LegendValuesResponseSchema,
  PreviewUploadRequestSchema,
  RenameDatasetRequestSchema,
  SplitCountRequestSchema,
  SplitCountResponseSchema,
  StagedUploadSchema,
  StagePathSchema,
  StageUploadRequestSchema,
  UploadTaskSchema,
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

const rejected = {
  422: errorResponse(
    "CSV 검사에서 거절 (옵션·스키마 오류, 올려 둔 파일 없음 등)",
  ),
};

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

export const stageUpload = createRoute({
  method: "post",
  path: "/datasets/staging",
  tags,
  summary:
    "CSV 또는 zip(CSV 여러 개를 하나로 합침)을 올려 둔다. 미리보기·검사로 옵션을 정한 뒤 commit으로 적재한다",
  ...write,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": { schema: StageUploadRequestSchema },
      },
    },
  },
  responses: {
    201: jsonResponse(StagedUploadSchema, "올려 둔 파일"),
    ...badRequest,
    ...authErrors,
    ...rejected,
  },
});

export const stageDataset = createRoute({
  method: "post",
  path: "/datasets/{datasetId}/staging",
  tags,
  summary:
    "업로드한 데이터셋의 원본을 다시 올려 둔다. 옵션·타입을 바꿔 commit하면 그 데이터셋을 다시 적재한다",
  ...write,
  request: { params: DatasetPathSchema },
  responses: {
    201: jsonResponse(StagedUploadSchema, "올려 둔 파일"),
    ...badRequest,
    ...authErrors,
    ...notFound,
    ...rejected,
  },
});

export const discardStage = createRoute({
  method: "delete",
  path: "/datasets/staging/{stageId}",
  tags,
  summary: "올려 둔 파일을 버린다",
  ...write,
  request: { params: StagePathSchema },
  responses: { 204: { description: "버림" }, ...badRequest, ...authErrors },
});

export const previewUpload = createRoute({
  method: "post",
  path: "/datasets/staging/{stageId}/preview",
  tags,
  summary:
    "올려 둔 파일 하나의 앞부분: 원본 줄, 컬럼과 추론 타입, 정한 타입으로 바꾼 앞쪽 행",
  ...write,
  request: {
    params: StagePathSchema,
    body: jsonBody(PreviewUploadRequestSchema),
  },
  responses: {
    200: jsonResponse(CsvPreviewSchema, "미리보기"),
    ...badRequest,
    ...authErrors,
    ...rejected,
  },
});

export const checkUpload = createRoute({
  method: "post",
  path: "/datasets/staging/{stageId}/check",
  tags,
  summary:
    "적재하지 않고 파일 전체를 검사한다: 행 수, 컬럼별 타입과 변환 불가 값 수",
  ...write,
  request: {
    params: StagePathSchema,
    body: jsonBody(CheckUploadRequestSchema),
  },
  responses: {
    200: jsonResponse(CsvCheckSchema, "검사 결과"),
    ...badRequest,
    ...authErrors,
    ...rejected,
  },
});

export const commitUpload = createRoute({
  method: "post",
  path: "/datasets/staging/{stageId}/commit",
  tags,
  summary:
    "올려 둔 파일을 적재한다. 검사·변환부터 백그라운드에서 하고 진행은 task long polling으로 받는다",
  ...write,
  request: {
    params: StagePathSchema,
    body: jsonBody(CommitUploadRequestSchema),
  },
  responses: {
    202: jsonResponse(UploadTaskSchema, "적재 시작"),
    ...badRequest,
    ...authErrors,
    ...rejected,
  },
});

export const uploadTask = createRoute({
  method: "get",
  path: "/datasets/staging/{stageId}/task",
  tags,
  summary:
    "업로드 진행 (long polling). since가 지금 version과 같으면 바뀔 때까지 최대 15초 기다린다",
  ...write,
  request: {
    params: StagePathSchema,
    query: z.object({
      since: z.coerce
        .number()
        .int()
        .optional()
        .openapi({ param: { name: "since", in: "query" } }),
    }),
  },
  responses: {
    200: jsonResponse(UploadTaskSchema, "진행"),
    ...badRequest,
    ...authErrors,
    404: errorResponse("commit하지 않은 stage"),
  },
});

export const renameDataset = createRoute({
  method: "patch",
  path: "/datasets/{datasetId}",
  tags,
  summary: "업로드한 데이터셋의 이름 변경",
  ...write,
  request: {
    params: DatasetPathSchema,
    body: jsonBody(RenameDatasetRequestSchema),
  },
  responses: {
    200: jsonResponse(DatasetStatusSchema, "바뀐 상태"),
    ...badRequest,
    ...authErrors,
    ...notFound,
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
