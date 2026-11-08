// 피드 search API 정의.

import { createRoute } from "@hono/zod-openapi";
import { errorResponse, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { SearchQuerySchema, SearchResponseSchema } from "./schemas";

export const searchPosts = createRoute({
  method: "get",
  path: "/search",
  tags: ["search"],
  summary:
    "게시물 찾기: 이슈 키(FD-12, 접두사·번호 일부) → 제목 → 본문 → 댓글 순으로 맞춘 결과 (볼 수 있는 것만, 기본 20개)",
  security: FEED_USER,
  request: { query: SearchQuerySchema },
  responses: {
    200: jsonResponse(SearchResponseSchema, "결과"),
    401: errorResponse("사용자를 고르지 않음"),
  },
});
