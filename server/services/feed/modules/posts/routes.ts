// 피드 posts API 정의. {postId}는 게시물 id 또는 이슈 키(FD-12)를 받는다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  AddChecklistItemRequestSchema,
  BulkUpdateRequestSchema,
  BulkUpdateResponseSchema,
  CreatePostRequestSchema,
  MyWorkSummarySchema,
  PinRequestSchema,
  PostDetailSchema,
  PostEventsResponseSchema,
  PostQueryRequestSchema,
  PostQueryResponseSchema,
  RejectRequestSchema,
  RelationRequestSchema,
  ReorderChecklistRequestSchema,
  SetParentRequestSchema,
  SubscribeRequestSchema,
  SubscribeResponseSchema,
  TransitionRequestSchema,
  UpdateChecklistItemRequestSchema,
  UpdatePostRequestSchema,
} from "./schemas";

const PostParams = z.object({ postId: PathId("postId") });
const ItemParams = PostParams.extend({ itemId: PathId("itemId") });

const auth = { 401: errorResponse("사용자를 고르지 않음") };
const errors = {
  400: errorResponse("요청 형식 오류, 필드 사이 규칙 위반"),
  ...auth,
  403: errorResponse("권한 없음 (전이 규칙, 그룹 역할)"),
  404: errorResponse("모르는 게시물 (볼 수 없는 비공개 그룹 포함)"),
  409: errorResponse("지금 상태에서 할 수 없는 전이"),
};
const detail = jsonResponse(PostDetailSchema, "바뀐 게시물");
const post = (
  method: "post" | "put" | "patch" | "delete",
  path: string,
  summary: string,
  request: Record<string, unknown>,
) =>
  createRoute({
    method,
    path,
    tags: ["posts"],
    summary,
    security: FEED_USER,
    request: { params: PostParams, ...request },
    responses: { 200: detail, ...errors },
  });

export const queryPosts = createRoute({
  method: "post",
  path: "/posts/query",
  tags: ["posts"],
  summary:
    "게시물 목록 (필터·정렬·페이지). 지운 것과 볼 수 없는 비공개 그룹은 뺀다",
  security: FEED_USER,
  request: { body: jsonBody(PostQueryRequestSchema) },
  responses: {
    200: jsonResponse(PostQueryResponseSchema, "목록"),
    400: errors[400],
    ...auth,
  },
});

export const getMyWorkSummary = createRoute({
  method: "get",
  path: "/posts/my-summary",
  tags: ["posts"],
  summary: "홈 상단 내 작업 요약 (담당·승인 대기·기한 임박 수)",
  security: FEED_USER,
  responses: { 200: jsonResponse(MyWorkSummarySchema, "요약"), ...auth },
});

export const getPost = createRoute({
  method: "get",
  path: "/posts/{postId}",
  tags: ["posts"],
  summary: "게시물 하나: 관계·체크리스트·이해관계자·구독 여부·첨부·권한",
  security: FEED_USER,
  request: { params: PostParams },
  responses: {
    200: jsonResponse(PostDetailSchema, "게시물"),
    ...auth,
    404: errors[404],
  },
});

export const createPost = createRoute({
  method: "post",
  path: "/posts",
  tags: ["posts"],
  summary:
    "게시물 만들기. next_seq로 키를 발급하고 created 이력을 남기며 작성자·담당자·요청자·이해관계자를 구독시킨다",
  security: FEED_USER,
  request: { body: jsonBody(CreatePostRequestSchema) },
  responses: {
    201: jsonResponse(PostDetailSchema, "만든 게시물"),
    400: errors[400],
    ...auth,
    403: errors[403],
    404: errorResponse("모르는 그룹"),
  },
});

export const updatePost = post(
  "patch",
  "/posts/{postId}",
  "게시물 고치기. 바뀐 필드마다 변경 이력 한 줄",
  { body: jsonBody(UpdatePostRequestSchema) },
);

export const deletePost = createRoute({
  method: "delete",
  path: "/posts/{postId}",
  tags: ["posts"],
  summary: "소프트 삭제 (작성자·그룹 관리자)",
  security: FEED_USER,
  request: { params: PostParams },
  responses: { 204: { description: "지움" }, ...errors },
});

export const transitionPost = post(
  "post",
  "/posts/{postId}/transition",
  "상태 전이 (규칙·권한 검사). 보류는 사유+재개일, 취소는 사유가 필수",
  { body: jsonBody(TransitionRequestSchema) },
);

export const requestPostReview = post(
  "post",
  "/posts/{postId}/request-review",
  "완료 요청: 진행 중 → 검토 중 (담당자)",
  {},
);

export const approvePost = post(
  "post",
  "/posts/{postId}/approve",
  "승인: 검토 중 → 해결됨 (요청자·그룹 관리자)",
  {},
);

export const rejectPost = post(
  "post",
  "/posts/{postId}/reject",
  "반려: 검토 중 → 진행 중, 반려 사유를 댓글로 남긴다 (요청자·그룹 관리자)",
  { body: jsonBody(RejectRequestSchema) },
);

export const reopenPost = post(
  "post",
  "/posts/{postId}/reopen",
  "다시 열기: 해결됨·취소 → 미해결, reopen_count 증가 (요청자·작성자·그룹 관리자)",
  {},
);

export const pinPost = post(
  "put",
  "/posts/{postId}/pin",
  "홈 피드에서 끌어올리기 켜기·끄기",
  { body: jsonBody(PinRequestSchema) },
);

export const bulkUpdatePosts = createRoute({
  method: "post",
  path: "/posts/bulk",
  tags: ["posts"],
  summary:
    "일괄 변경. 게시물마다 update/transition과 같은 규칙으로 바꾸고, 못 바꾼 것은 이유와 함께 돌려준다",
  security: FEED_USER,
  request: { body: jsonBody(BulkUpdateRequestSchema) },
  responses: {
    200: jsonResponse(BulkUpdateResponseSchema, "결과"),
    400: errors[400],
    ...auth,
  },
});

export const setPostParent = post(
  "put",
  "/posts/{postId}/parent",
  "상위 이슈 정하기(null이면 떼기). 같은 그룹만, 순환 금지. 상위 진행률을 다시 계산한다",
  { body: jsonBody(SetParentRequestSchema) },
);

export const addPostRelation = post(
  "post",
  "/posts/{postId}/relations",
  "관계 추가 (이 게시물이 from)",
  { body: jsonBody(RelationRequestSchema) },
);

export const removePostRelation = post(
  "post",
  "/posts/{postId}/relations/remove",
  "관계 지우기",
  { body: jsonBody(RelationRequestSchema) },
);

export const addChecklistItem = post(
  "post",
  "/posts/{postId}/checklist",
  "체크리스트 항목 추가. 진행률을 다시 계산한다",
  { body: jsonBody(AddChecklistItemRequestSchema) },
);

export const updateChecklistItem = createRoute({
  method: "patch",
  path: "/posts/{postId}/checklist/{itemId}",
  tags: ["posts"],
  summary: "체크리스트 항목 고치기·체크",
  security: FEED_USER,
  request: {
    params: ItemParams,
    body: jsonBody(UpdateChecklistItemRequestSchema),
  },
  responses: { 200: detail, ...errors },
});

export const removeChecklistItem = createRoute({
  method: "delete",
  path: "/posts/{postId}/checklist/{itemId}",
  tags: ["posts"],
  summary: "체크리스트 항목 지우기",
  security: FEED_USER,
  request: { params: ItemParams },
  responses: { 200: detail, ...errors },
});

export const reorderChecklist = post(
  "put",
  "/posts/{postId}/checklist/order",
  "체크리스트 순서 (ids 순서대로)",
  { body: jsonBody(ReorderChecklistRequestSchema) },
);

export const subscribePost = createRoute({
  method: "put",
  path: "/posts/{postId}/subscribe",
  tags: ["posts"],
  summary: "알림 구독 켜기·끄기",
  security: FEED_USER,
  request: { params: PostParams, body: jsonBody(SubscribeRequestSchema) },
  responses: {
    200: jsonResponse(SubscribeResponseSchema, "지금 상태"),
    ...auth,
    404: errors[404],
  },
});

export const listPostEvents = createRoute({
  method: "get",
  path: "/posts/{postId}/events",
  tags: ["posts"],
  summary: "변경 이력 (오래된 순). 활동 로그 타임라인",
  security: FEED_USER,
  request: { params: PostParams },
  responses: {
    200: jsonResponse(PostEventsResponseSchema, "이력"),
    ...auth,
    404: errors[404],
  },
});
