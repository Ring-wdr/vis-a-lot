// 피드 posts API 스키마: 게시물(이슈), 목록 조회, 전이, 관계, 체크리스트, 구독, 변경 이력.

import { z } from "@hono/zod-openapi";
import {
  CancelReasonSchema,
  DaySchema,
  HoldReasonSchema,
  InstantSchema,
  orNull,
  PostFormatSchema,
  PostRefSchema,
  PostStatusSchema,
  PrioritySchema,
  RelationKindSchema,
  StatusCategorySchema,
} from "../common";

/** 목록·피드·보드 카드에 쓰는 게시물 */
export const PostSummarySchema = z
  .object({
    id: z.string(),
    key: z.string(),
    groupId: z.string(),
    teamId: z.string().nullable(),
    postTypeId: z.string().nullable(),
    format: PostFormatSchema,
    title: z.string(),
    status: PostStatusSchema,
    category: StatusCategorySchema,
    priority: PrioritySchema,
    /** 0~100. 하위·체크리스트가 있으면 자동 계산된 값 */
    progress: z.number().int(),
    authorId: z.string(),
    assigneeId: z.string().nullable(),
    requesterId: z.string().nullable(),
    stakeholderIds: z.array(z.string()),
    parentId: z.string().nullable(),
    dueDate: orNull(DaySchema),
    holdUntil: orNull(DaySchema),
    /** 취소 사유(CancelReason) 또는 보류 사유(HoldReason) */
    closeReason: z.string().nullable(),
    tags: z.array(z.string()),
    thumbnail: z.string().nullable(),
    pinnedAt: orNull(InstantSchema),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
    resolvedAt: orNull(InstantSchema),
    commentCount: z.number().int(),
    childCount: z.number().int(),
    childResolvedCount: z.number().int(),
    /** 열린 게시물이 이 게시물을 막고 있다 (blocks 관계) */
    blocked: z.boolean(),
  })
  .openapi("PostSummary");

export const ChecklistItemSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    done: z.boolean(),
    sort: z.number().int(),
  })
  .openapi("ChecklistItem");

export const PostRelationSchema = z
  .object({
    kind: RelationKindSchema,
    /** outgoing: 이 게시물이 from (예: 이 게시물이 상대를 막음), incoming: 이 게시물이 to */
    direction: z.enum(["outgoing", "incoming"]),
    post: PostRefSchema,
  })
  .openapi("PostRelation");

export const AttachmentSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["file", "link"]),
    name: z.string(),
    url: z.string(),
  })
  .openapi("Attachment");

/** 지금 사용자가 이 게시물에 할 수 있는 것. 화면은 버튼을 이 값으로 켜고 끈다 */
export const PostPermissionsSchema = z
  .object({
    edit: z.boolean(),
    /** transition으로 갈 수 있는 상태 (보드 드래그 대상) */
    transitions: z.array(PostStatusSchema),
    requestReview: z.boolean(),
    approve: z.boolean(),
    reject: z.boolean(),
    reopen: z.boolean(),
    delete: z.boolean(),
  })
  .openapi("PostPermissions");

export const PostDetailSchema = PostSummarySchema.extend({
  /** Tiptap JSON */
  body: z.unknown().nullable(),
  /** 형식별 내용: 차트 데이터·이미지·동영상 링크·코드 */
  payload: z.unknown().nullable(),
  reopenCount: z.number().int(),
  checklist: z.array(ChecklistItemSchema),
  relations: z.array(PostRelationSchema),
  parent: orNull(PostRefSchema),
  children: z.array(PostRefSchema),
  attachments: z.array(AttachmentSchema),
  subscribed: z.boolean(),
  permissions: PostPermissionsSchema,
}).openapi("PostDetail");

export const PostSortFieldSchema = z
  .enum([
    "updatedAt",
    "createdAt",
    "dueDate",
    "priority",
    "key",
    "title",
    "status",
  ])
  .openapi("PostSortField");

/** 목록 필터. 저장된 뷰도 이 모양을 저장한다. 비어 있는 조건은 거르지 않는다 */
export const PostFilterSchema = z
  .object({
    groupIds: z.array(z.string()),
    teamIds: z.array(z.string()),
    statuses: z.array(PostStatusSchema),
    categories: z.array(StatusCategorySchema),
    priorities: z.array(PrioritySchema),
    assigneeIds: z.array(z.string()),
    requesterIds: z.array(z.string()),
    stakeholderIds: z.array(z.string()),
    authorIds: z.array(z.string()),
    postTypeIds: z.array(z.string()),
    formats: z.array(PostFormatSchema),
    tags: z.array(z.string()),
    dueFrom: DaySchema,
    dueTo: DaySchema,
    /** 기한이 지난 열린 게시물만 */
    overdue: z.boolean(),
    /** 제목·본문 부분 일치 */
    q: z.string(),
    /** 내 작업 탭: 지금 사용자 기준 */
    mine: z.enum(["assigned", "requested", "review", "stakeholder"]),
    /** 지금 사용자가 관심(팔로우)한 사람이 쓴 것만 */
    followedAuthors: z.boolean(),
    parentId: z.string(),
  })
  .partial()
  .openapi("PostFilter");

export const PostQueryRequestSchema = z
  .object({
    filter: PostFilterSchema.default({}),
    sort: z
      .object({ field: PostSortFieldSchema, dir: z.enum(["asc", "desc"]) })
      .default({ field: "updatedAt", dir: "desc" }),
    /** 끌어올린(pin) 게시물을 먼저 (홈 피드) */
    pinnedFirst: z.boolean().default(false),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .openapi("PostQueryRequest");

export const PostQueryResponseSchema = z
  .object({ posts: z.array(PostSummarySchema), total: z.number().int() })
  .openapi("PostQueryResponse");

export const CreatePostRequestSchema = z
  .object({
    groupId: z.string(),
    title: z.string().min(1).max(200),
    format: PostFormatSchema.default("image"),
    postTypeId: z.string().nullable().optional(),
    teamId: z.string().nullable().optional(),
    priority: PrioritySchema.default(2),
    body: z.unknown().optional(),
    payload: z.unknown().optional(),
    thumbnail: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    /** 없으면 작성자가 요청자 역할 */
    requesterId: z.string().nullable().optional(),
    stakeholderIds: z.array(z.string()).default([]),
    dueDate: orNull(DaySchema).optional(),
    parentId: z.string().nullable().optional(),
    checklist: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string().min(1)).default([]),
    attachments: z
      .array(
        z.object({
          kind: z.enum(["file", "link"]),
          name: z.string().min(1),
          url: z.string().min(1),
        }),
      )
      .default([]),
  })
  .openapi("CreatePostRequest");

/** 바꿀 필드만. 바뀐 필드마다 변경 이력이 한 줄씩 남는다 */
export const UpdatePostRequestSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.unknown(),
    payload: z.unknown(),
    thumbnail: z.string().nullable(),
    format: PostFormatSchema,
    postTypeId: z.string().nullable(),
    teamId: z.string().nullable(),
    priority: PrioritySchema,
    assigneeId: z.string().nullable(),
    requesterId: z.string().nullable(),
    stakeholderIds: z.array(z.string()),
    dueDate: orNull(DaySchema),
    /** 하위·체크리스트가 없을 때만 (있으면 400) */
    progress: z.number().int().min(0).max(100),
    tags: z.array(z.string().min(1)),
  })
  .partial()
  .openapi("UpdatePostRequest");

export const TransitionRequestSchema = z
  .object({
    to: PostStatusSchema,
    /** 보류는 HoldReason, 취소는 CancelReason (필수) */
    reason: z.union([HoldReasonSchema, CancelReasonSchema]).optional(),
    /** 보류 재개 예정일 (보류일 때 필수) */
    holdUntil: DaySchema.optional(),
  })
  .openapi("TransitionRequest");

export const RejectRequestSchema = z
  .object({ comment: z.string().min(1).max(2000) })
  .openapi("RejectRequest");

export const PinRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("PinRequest");

export const BulkUpdateRequestSchema = z
  .object({
    ids: z.array(z.string()).min(1).max(200),
    patch: z
      .object({
        status: PostStatusSchema,
        priority: PrioritySchema,
        assigneeId: z.string().nullable(),
        dueDate: orNull(DaySchema),
        postTypeId: z.string().nullable(),
        teamId: z.string().nullable(),
      })
      .partial(),
  })
  .openapi("BulkUpdateRequest");

export const BulkUpdateResponseSchema = z
  .object({
    updated: z.array(z.string()),
    /** 권한·전이 규칙으로 바꾸지 못한 게시물과 이유 */
    failed: z.array(z.object({ id: z.string(), error: z.string() })),
  })
  .openapi("BulkUpdateResponse");

export const SetParentRequestSchema = z
  .object({ parentId: z.string().nullable() })
  .openapi("SetParentRequest");

export const RelationRequestSchema = z
  .object({ toId: z.string(), kind: RelationKindSchema })
  .openapi("RelationRequest");

export const AddChecklistItemRequestSchema = z
  .object({ text: z.string().min(1).max(200) })
  .openapi("AddChecklistItemRequest");

export const UpdateChecklistItemRequestSchema = z
  .object({ text: z.string().min(1).max(200), done: z.boolean() })
  .partial()
  .openapi("UpdateChecklistItemRequest");

export const ReorderChecklistRequestSchema = z
  .object({ ids: z.array(z.string()) })
  .openapi("ReorderChecklistRequest");

export const SubscribeRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("SubscribeRequest");

export const SubscribeResponseSchema = z
  .object({ subscribed: z.boolean() })
  .openapi("SubscribeResponse");

export const FeedEventSchema = z
  .object({
    id: z.string(),
    postId: z.string(),
    actorId: z.string(),
    /** server/feed/events.ts의 EVENT_KINDS */
    kind: z.string(),
    field: z.string().nullable(),
    oldValue: z.string().nullable(),
    newValue: z.string().nullable(),
    commentId: z.string().nullable(),
    createdAt: InstantSchema,
  })
  .openapi("FeedEvent");

export const PostEventsResponseSchema = z
  .object({ events: z.array(FeedEventSchema) })
  .openapi("PostEventsResponse");

/** 홈 상단 내 작업 요약 띠 */
export const MyWorkSummarySchema = z
  .object({
    /** 내가 담당인 열린 게시물 */
    assigned: z.number().int(),
    /** 내가 승인할 검토 중 게시물 (요청자이거나, 요청자 없는 게시물의 작성자이거나, 그룹 관리자) */
    awaitingReview: z.number().int(),
    /** 내가 담당인 열린 게시물 중 기한이 오늘부터 3일 안이거나 지난 것 */
    dueSoon: z.number().int(),
  })
  .openapi("MyWorkSummary");

export type PostSummary = z.infer<typeof PostSummarySchema>;
export type PostDetail = z.infer<typeof PostDetailSchema>;
export type PostPermissions = z.infer<typeof PostPermissionsSchema>;
export type PostFilter = z.infer<typeof PostFilterSchema>;
export type PostQueryRequest = z.infer<typeof PostQueryRequestSchema>;
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;
export type UpdatePostRequest = z.infer<typeof UpdatePostRequestSchema>;
export type TransitionRequest = z.infer<typeof TransitionRequestSchema>;
export type BulkUpdateRequest = z.infer<typeof BulkUpdateRequestSchema>;
export type BulkUpdateResponse = z.infer<typeof BulkUpdateResponseSchema>;
export type FeedEvent = z.infer<typeof FeedEventSchema>;
export type MyWorkSummary = z.infer<typeof MyWorkSummarySchema>;
