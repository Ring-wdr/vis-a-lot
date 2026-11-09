// 피드 seed API 정의 (/feed/dev/seed). 리셋·기본 시나리오 적재는 system API에 있다.

import { createRoute } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FeedSnapshotSchema, SeedImportResponseSchema } from "./schemas";

export const exportSeed = createRoute({
  method: "get",
  path: "/seed/export",
  tags: ["seed"],
  summary: "피드 데이터 전체를 JSON으로",
  responses: { 200: jsonResponse(FeedSnapshotSchema, "스냅숏") },
});

export const importSeed = createRoute({
  method: "post",
  path: "/seed/import",
  tags: ["seed"],
  summary: "피드 데이터를 지우고 스냅숏으로 채운다",
  request: { body: jsonBody(FeedSnapshotSchema) },
  responses: {
    200: jsonResponse(SeedImportResponseSchema, "넣은 행 수"),
    400: errorResponse("스키마 버전이 다르거나 형식 오류"),
  },
});
