// 피드 comments API: 댓글·반응·투표·스레드 해결·고정, 게시물 첨부. postId 자리에는 id나 이슈 키를 넣는다.

import type { components } from "@/shared/api/generated/feed";
import { feedClient, unwrap } from "./client";

type Feed = components["schemas"];

export type Comment = Feed["Comment"];
export type CommentThread = Feed["CommentThread"];
export type Reaction = Feed["Reaction"];
export type Poll = Feed["Poll"];
export type CreateCommentRequest = Feed["CreateCommentRequest"];
export type AddAttachmentRequest = Feed["AddAttachmentRequest"];

const post = (postId: string) => ({ params: { path: { postId } } });
const comment = (commentId: string) => ({ params: { path: { commentId } } });

export const commentsApi = {
  list: (postId: string) =>
    unwrap(feedClient.GET("/posts/{postId}/comments", post(postId))),
  create: (postId: string, body: CreateCommentRequest) =>
    unwrap(
      feedClient.POST("/posts/{postId}/comments", { ...post(postId), body }),
    ),
  update: (commentId: string, body: unknown) =>
    unwrap(
      feedClient.PATCH("/comments/{commentId}", {
        ...comment(commentId),
        body: { body },
      }),
    ),
  remove: (commentId: string) =>
    unwrap(feedClient.DELETE("/comments/{commentId}", comment(commentId))),
  resolve: (commentId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/comments/{commentId}/resolve", {
        ...comment(commentId),
        body: { on },
      }),
    ),
  pin: (commentId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/comments/{commentId}/pin", {
        ...comment(commentId),
        body: { on },
      }),
    ),
  react: (commentId: string, emoji: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/comments/{commentId}/reactions", {
        ...comment(commentId),
        body: { emoji, on },
      }),
    ),
  vote: (pollId: string, optionIdx: number) =>
    unwrap(
      feedClient.PUT("/polls/{pollId}/vote", {
        params: { path: { pollId } },
        body: { optionIdx },
      }),
    ),
  addAttachment: (postId: string, body: AddAttachmentRequest) =>
    unwrap(
      feedClient.POST("/posts/{postId}/attachments", { ...post(postId), body }),
    ),
  removeAttachment: (postId: string, attachmentId: string) =>
    unwrap(
      feedClient.DELETE("/posts/{postId}/attachments/{attachmentId}", {
        params: { path: { postId, attachmentId } },
      }),
    ),
};
