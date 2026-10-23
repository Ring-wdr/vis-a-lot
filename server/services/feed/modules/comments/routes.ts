// 피드 comments API 정의. 댓글을 쓰면 comment 이력과 멘션 이력이 남고, 쓴 사람과 멘션된 사람이 구독된다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  AddAttachmentRequestSchema,
  AttachmentSchema,
  CommentListResponseSchema,
  CommentSchema,
  CreateCommentRequestSchema,
  ReactionRequestSchema,
  ToggleRequestSchema,
  UpdateCommentRequestSchema,
  VoteRequestSchema,
} from "./schemas";

const PostParams = z.object({ postId: PathId("postId") });
const CommentParams = z.object({ commentId: PathId("commentId") });
const errors = {
  400: errorResponse("요청 형식 오류 (빈 본문, 마감된 투표 등)"),
  401: errorResponse("사용자를 고르지 않음"),
  403: errorResponse("권한 없음"),
  404: errorResponse("모르는 게시물·댓글 (볼 수 없는 것 포함)"),
};
const comment = jsonResponse(CommentSchema, "바뀐 댓글");
const route = <B extends { body?: ReturnType<typeof jsonBody> }>(
  method: "put" | "patch",
  path: string,
  summary: string,
  request: B,
) =>
  createRoute({
    method,
    path,
    tags: ["comments"],
    summary,
    security: FEED_USER,
    request: { params: CommentParams, ...request },
    responses: { 200: comment, ...errors },
  });

export const listComments = createRoute({
  method: "get",
  path: "/posts/{postId}/comments",
  tags: ["comments"],
  summary: "게시물 댓글 스레드",
  security: FEED_USER,
  request: { params: PostParams },
  responses: {
    200: jsonResponse(CommentListResponseSchema, "스레드"),
    401: errors[401],
    404: errors[404],
  },
});

export const createComment = createRoute({
  method: "post",
  path: "/posts/{postId}/comments",
  tags: ["comments"],
  summary:
    "댓글 쓰기 (게시물을 볼 수 있으면 누구나). 멘션을 읽어 멘션 이력·알림을 남기고, 쓴 사람·멘션된 사람을 구독시킨다",
  security: FEED_USER,
  request: { params: PostParams, body: jsonBody(CreateCommentRequestSchema) },
  responses: { 201: jsonResponse(CommentSchema, "쓴 댓글"), ...errors },
});

export const updateComment = route(
  "patch",
  "/comments/{commentId}",
  "댓글 고치기 (쓴 사람만). 새로 멘션된 사람에게만 멘션 알림",
  { body: jsonBody(UpdateCommentRequestSchema) },
);

export const deleteComment = createRoute({
  method: "delete",
  path: "/comments/{commentId}",
  tags: ["comments"],
  summary: "댓글 지우기 (쓴 사람·그룹 관리자). 소프트 삭제",
  security: FEED_USER,
  request: { params: CommentParams },
  responses: { 204: { description: "지움" }, ...errors },
});

export const resolveComment = route(
  "put",
  "/comments/{commentId}/resolve",
  "스레드 해결·다시 열기 (스레드 첫 댓글만. 게시물을 고칠 수 있는 사람과 댓글 쓴 사람)",
  { body: jsonBody(ToggleRequestSchema) },
);

export const pinComment = route(
  "put",
  "/comments/{commentId}/pin",
  "스레드 고정 (스레드 첫 댓글만. 게시물을 고칠 수 있는 사람)",
  { body: jsonBody(ToggleRequestSchema) },
);

export const reactComment = route(
  "put",
  "/comments/{commentId}/reactions",
  "반응 켜기·끄기 (지운 댓글은 400)",
  { body: jsonBody(ReactionRequestSchema) },
);

export const votePoll = createRoute({
  method: "put",
  path: "/polls/{pollId}/vote",
  tags: ["comments"],
  summary: "투표 (한 사람 한 표, 다시 고르면 바뀐다. 마감 뒤 400)",
  security: FEED_USER,
  request: {
    params: z.object({ pollId: PathId("pollId") }),
    body: jsonBody(VoteRequestSchema),
  },
  responses: {
    200: jsonResponse(CommentSchema, "투표가 달린 댓글"),
    ...errors,
  },
});

export const addPostAttachment = createRoute({
  method: "post",
  path: "/posts/{postId}/attachments",
  tags: ["comments"],
  summary: "게시물에 파일·링크 첨부 (게시물을 고칠 수 있는 사람)",
  security: FEED_USER,
  request: { params: PostParams, body: jsonBody(AddAttachmentRequestSchema) },
  responses: { 201: jsonResponse(AttachmentSchema, "첨부"), ...errors },
});

export const removePostAttachment = createRoute({
  method: "delete",
  path: "/posts/{postId}/attachments/{attachmentId}",
  tags: ["comments"],
  summary: "첨부 지우기",
  security: FEED_USER,
  request: {
    params: PostParams.extend({ attachmentId: PathId("attachmentId") }),
  },
  responses: { 204: { description: "지움" }, ...errors },
});
