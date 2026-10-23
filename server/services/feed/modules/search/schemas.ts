// 피드 search API 스키마: 커맨드 팔레트와 게시물 찾기.

import { z } from "@hono/zod-openapi";
import { PostRefSchema } from "../common";

export const SearchQuerySchema = z.object({
  q: z.string().openapi({ param: { name: "q", in: "query" } }),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .openapi({ param: { name: "limit", in: "query" } }),
});

export const SearchHitSchema = PostRefSchema.extend({
  /** 어디서 찾았나: 이슈 키, 제목, 본문, 댓글 */
  matchedIn: z.enum(["key", "title", "body", "comment"]),
  /** 본문·댓글에서 찾았으면 그 주변 글 */
  snippet: z.string().nullable(),
}).openapi("SearchHit");

export const SearchResponseSchema = z
  .object({ hits: z.array(SearchHitSchema) })
  .openapi("SearchResponse");

export type SearchHit = z.infer<typeof SearchHitSchema>;
