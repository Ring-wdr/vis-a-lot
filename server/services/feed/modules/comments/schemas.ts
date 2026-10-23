// 피드 comments API 스키마: 댓글(대댓글·반응·투표·스레드 해결·고정), 게시물 첨부.

import { z } from "@hono/zod-openapi";
import { InstantSchema, orNull } from "../common";
import { AttachmentSchema } from "../posts/schemas";

export const ReactionSchema = z
  .object({
    emoji: z.string(),
    count: z.number().int(),
    /** 지금 사용자가 누른 반응 */
    mine: z.boolean(),
  })
  .openapi("Reaction");

export const PollSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    closesAt: orNull(InstantSchema),
    /** 선택지별 표 수 (options와 같은 순서) */
    votes: z.array(z.number().int()),
    /** 지금 사용자가 고른 선택지. 안 골랐으면 null */
    myVote: z.number().int().nullable(),
    /** 마감이 지났다 (ctx.now 기준) */
    closed: z.boolean(),
  })
  .openapi("Poll");

export const CommentSchema = z
  .object({
    id: z.string(),
    postId: z.string(),
    authorId: z.string(),
    parentId: z.string().nullable(),
    /** Tiptap JSON. 지운 댓글은 null */
    body: z.unknown().nullable(),
    /** 스레드 해결 (스레드 첫 댓글에만 의미가 있다) */
    resolved: z.boolean(),
    pinned: z.boolean(),
    /** 지운 댓글. 대댓글이 있으면 자리를 남겨 '삭제된 댓글'로 보여준다 */
    deleted: z.boolean(),
    createdAt: InstantSchema,
    updatedAt: orNull(InstantSchema),
    /** 본문의 멘션 노드에서 읽은 사용자 id */
    mentions: z.array(z.string()),
    reactions: z.array(ReactionSchema),
    poll: orNull(PollSchema),
    /** 지금 사용자가 할 수 있는 것 */
    permissions: z.object({
      edit: z.boolean(),
      delete: z.boolean(),
      resolve: z.boolean(),
      pin: z.boolean(),
    }),
  })
  .openapi("Comment");

export const CommentThreadSchema = CommentSchema.extend({
  replies: z.array(CommentSchema),
}).openapi("CommentThread");

export const CommentListResponseSchema = z
  .object({
    /** 고정한 스레드 먼저, 그다음 오래된 순. 대댓글은 오래된 순 */
    threads: z.array(CommentThreadSchema),
  })
  .openapi("CommentListResponse");

export const CreateCommentRequestSchema = z
  .object({
    /** Tiptap JSON (doc). 멘션은 { type: 'mention', attrs: { id: <user id>, label } } 노드 */
    body: z.unknown(),
    /** 대댓글이면 스레드 첫 댓글 id (대댓글의 대댓글은 그 스레드에 붙인다) */
    parentId: z.string().optional(),
    poll: z
      .object({
        question: z.string().min(1).max(200),
        options: z.array(z.string().min(1).max(80)).min(2).max(6),
        closesAt: InstantSchema.optional(),
      })
      .optional(),
  })
  .openapi("CreateCommentRequest");

export const UpdateCommentRequestSchema = z
  .object({ body: z.unknown() })
  .openapi("UpdateCommentRequest");

export const ToggleRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("ToggleRequest");

export const ReactionRequestSchema = z
  .object({ emoji: z.string().min(1).max(16), on: z.boolean() })
  .openapi("ReactionRequest");

export const VoteRequestSchema = z
  .object({ optionIdx: z.number().int().min(0) })
  .openapi("VoteRequest");

export const AddAttachmentRequestSchema = z
  .object({
    kind: z.enum(["file", "link"]),
    name: z.string().min(1).max(200),
    /** 링크 URL 또는 파일 data URL (프로토타입은 브라우저 안에 둔다) */
    url: z.string().min(1),
  })
  .openapi("AddAttachmentRequest");

export { AttachmentSchema };

export type Comment = z.infer<typeof CommentSchema>;
export type CommentThread = z.infer<typeof CommentThreadSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;
