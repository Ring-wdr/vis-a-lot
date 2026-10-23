// 피드 views API 스키마: 저장된 뷰(필터 + 표시 방식 + 정렬·그룹핑).

import { z } from "@hono/zod-openapi";
import { PostFilterSchema, PostSortFieldSchema } from "../posts/schemas";

export const ViewLayoutSchema = z
  .enum(["feed", "list", "board"])
  .openapi("ViewLayout");

/** 리스트 그룹핑 */
export const ViewGroupBySchema = z
  .enum(["status", "assignee", "priority"])
  .openapi("ViewGroupBy");

export const ViewSortSchema = z
  .object({ field: PostSortFieldSchema, dir: z.enum(["asc", "desc"]) })
  .openapi("ViewSort");

export const SavedViewSchema = z
  .object({
    /** 기본 제공 뷰는 'builtin-explore'(탐색), 'builtin-following'(관심) */
    id: z.string(),
    ownerId: z.string().nullable(),
    /** 그룹 공유 뷰의 그룹. 개인 뷰는 null일 수 있다 */
    groupId: z.string().nullable(),
    name: z.string(),
    /** 그룹 멤버에게 공유 (groupId 필요) */
    shared: z.boolean(),
    layout: ViewLayoutSchema,
    filter: PostFilterSchema,
    sort: ViewSortSchema.nullable(),
    groupBy: ViewGroupBySchema.nullable(),
    /** 사이드바 고정 */
    pinned: z.boolean(),
    /** 기본 제공 뷰 (고치거나 지울 수 없다) */
    builtin: z.boolean(),
    /** 지금 사용자가 고치고 지울 수 있다 (내 뷰, 또는 그룹 관리자의 공유 뷰) */
    editable: z.boolean(),
  })
  .openapi("SavedView");

export const ViewListQuerySchema = z.object({
  groupId: z
    .string()
    .optional()
    .openapi({ param: { name: "groupId", in: "query" } }),
});

export const ViewListResponseSchema = z
  .object({ views: z.array(SavedViewSchema) })
  .openapi("ViewListResponse");

export const SaveViewRequestSchema = z
  .object({
    /** 있으면 고치기 */
    id: z.string().optional(),
    groupId: z.string().nullable().default(null),
    name: z.string().min(1).max(60),
    shared: z.boolean().default(false),
    layout: ViewLayoutSchema,
    filter: PostFilterSchema.default({}),
    sort: ViewSortSchema.nullable().default(null),
    groupBy: ViewGroupBySchema.nullable().default(null),
    pinned: z.boolean().default(false),
  })
  .openapi("SaveViewRequest");

export const PinViewRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("PinViewRequest");

export type SavedView = z.infer<typeof SavedViewSchema>;
export type SaveViewRequest = z.input<typeof SaveViewRequestSchema>;
