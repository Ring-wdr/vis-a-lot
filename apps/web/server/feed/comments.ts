// 피드 comments 모듈: 댓글(대댓글·반응·투표·스레드 해결·고정), 멘션, 게시물 첨부.
// 댓글을 쓰면 comment 이력과 멘션 이력을 남기고, 쓴 사람·멘션된 사람을 구독시킨다. 모양은 comments/mapper.ts.

import type { z } from "@hono/zod-openapi";
import type {
  AttachmentSchema,
  Comment,
  CommentThread,
  CreateCommentRequest,
} from "../services/feed/modules/comments/schemas";
import { type CommentRow, loadThreads, toComments } from "./comments/mapper";
import {
  hasContent,
  isDoc,
  mentionIds,
  recordMentions,
} from "./comments/mentions";
import {
  type Actor,
  defineOps,
  FeedError,
  newId,
  type OpCtx,
  requireActor,
} from "./context";
import { recordEvent } from "./events";
import { autoSubscribe, findPost, type PostRow, postRoles } from "./posts/load";
import { canEdit } from "./posts/workflow";

type Attachment = z.infer<typeof AttachmentSchema>;
type CommentArgs = { commentId: string };
type ToggleArgs = CommentArgs & { on: boolean };

/** 댓글과 그 게시물. 게시물을 볼 수 없으면 404 */
async function findComment(ctx: OpCtx, commentId: string) {
  const comment = await ctx.db
    .selectFrom("comments")
    .selectAll()
    .where("id", "=", commentId)
    .executeTakeFirst();
  if (!comment) throw new FeedError(404, `모르는 댓글입니다: ${commentId}`);
  try {
    return { comment, post: await findPost(ctx, comment.post_id) };
  } catch (err) {
    if (err instanceof FeedError && err.status === 404)
      throw new FeedError(404, `모르는 댓글입니다: ${commentId}`);
    throw err;
  }
}

async function one(
  ctx: OpCtx,
  post: PostRow,
  actor: Actor,
  commentId: string,
): Promise<Comment> {
  const row = await ctx.db
    .selectFrom("comments")
    .selectAll()
    .where("id", "=", commentId)
    .executeTakeFirstOrThrow();
  const [comment] = await toComments(ctx, post, actor, [row]);
  return comment;
}

async function requirePostEditor(ctx: OpCtx, post: PostRow, actor: Actor) {
  if (!canEdit(await postRoles(ctx, post, actor)))
    throw new FeedError(403, "이 게시물을 고칠 권한이 없습니다");
}

function requireRoot(comment: CommentRow) {
  if (comment.parent_id !== null)
    throw new FeedError(400, "스레드 첫 댓글에만 할 수 있습니다");
}

function requireLive(comment: CommentRow) {
  if (comment.deleted_at) throw new FeedError(400, "지운 댓글입니다");
}

/** 본문 검증: Tiptap 문서여야 하고, 투표가 없으면 내용이 있어야 한다. 빈 문서는 null로 둔다 */
function checkBody(body: unknown, allowEmpty: boolean): unknown {
  if (body == null || (isDoc(body) && !hasContent(body))) {
    if (allowEmpty) return null;
    throw new FeedError(400, "댓글 내용을 입력하세요");
  }
  if (!isDoc(body)) throw new FeedError(400, "본문은 Tiptap 문서여야 합니다");
  return body;
}

async function touch(ctx: OpCtx, postId: string) {
  await ctx.db
    .updateTable("posts")
    .set({ updated_at: ctx.now })
    .where("id", "=", postId)
    .execute();
}

export const commentsOps = defineOps({
  "comments.list": async (
    ctx,
    args: { postId: string },
  ): Promise<{ threads: CommentThread[] }> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    return { threads: await loadThreads(ctx, post, actor) };
  },

  "comments.create": async (
    ctx,
    args: { postId: string } & CreateCommentRequest,
  ): Promise<Comment> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    const body = checkBody(args.body, !!args.poll);
    let parentId: string | null = null;
    if (args.parentId) {
      const parent = await ctx.db
        .selectFrom("comments")
        .select(["id", "parent_id"])
        .where("id", "=", args.parentId)
        .where("post_id", "=", post.id)
        .executeTakeFirst();
      if (!parent)
        throw new FeedError(400, "같은 게시물의 댓글에만 답할 수 있습니다");
      // 대댓글의 대댓글은 스레드 첫 댓글에 붙인다
      parentId = parent.parent_id ?? parent.id;
    }
    if (args.poll && parentId)
      throw new FeedError(400, "투표는 스레드 첫 댓글에만 붙입니다");

    const id = newId("c");
    await ctx.db
      .insertInto("comments")
      .values({
        id,
        post_id: post.id,
        author_id: actor.id,
        parent_id: parentId,
        body: body == null ? null : JSON.stringify(body),
        created_at: ctx.now,
      })
      .execute();
    if (args.poll)
      await ctx.db
        .insertInto("polls")
        .values({
          id: newId("poll"),
          comment_id: id,
          question: args.poll.question,
          options: JSON.stringify(args.poll.options),
          closes_at: args.poll.closesAt ?? null,
        })
        .execute();
    // 멘션된 사람은 멘션 알림만 받는다 (이미 구독 중이어도 댓글 알림은 보내지 않는다)
    const mentioned = mentionIds(body);
    await recordEvent(ctx, {
      postId: post.id,
      kind: "comment",
      commentId: id,
      excludedRecipients: mentioned,
    });
    await autoSubscribe(ctx, post.id, [actor.id]);
    await recordMentions(ctx, post, mentioned, id);
    return one(ctx, post, actor, id);
  },

  "comments.update": async (
    ctx,
    args: CommentArgs & { body: unknown },
  ): Promise<Comment> => {
    const actor = requireActor(ctx);
    const { comment, post } = await findComment(ctx, args.commentId);
    requireLive(comment);
    if (comment.author_id !== actor.id)
      throw new FeedError(403, "쓴 사람만 고칠 수 있습니다");
    const poll = await ctx.db
      .selectFrom("polls")
      .select("id")
      .where("comment_id", "=", comment.id)
      .executeTakeFirst();
    const body = checkBody(args.body, !!poll);
    await ctx.db
      .updateTable("comments")
      .set({
        body: body == null ? null : JSON.stringify(body),
        updated_at: ctx.now,
      })
      .where("id", "=", comment.id)
      .execute();
    // 새로 멘션된 사람에게만 알린다
    const before = new Set(mentionIds(comment.body));
    await recordMentions(
      ctx,
      post,
      mentionIds(body).filter((id) => !before.has(id)),
      comment.id,
    );
    return one(ctx, post, actor, comment.id);
  },

  "comments.delete": async (ctx, args: CommentArgs): Promise<void> => {
    const actor = requireActor(ctx);
    const { comment, post } = await findComment(ctx, args.commentId);
    if (comment.deleted_at) return;
    const roles = await postRoles(ctx, post, actor);
    if (comment.author_id !== actor.id && !roles.admin)
      throw new FeedError(403, "쓴 사람이나 그룹 관리자만 지울 수 있습니다");
    await ctx.db
      .updateTable("comments")
      .set({ deleted_at: ctx.now })
      .where("id", "=", comment.id)
      .execute();
  },

  "comments.resolve": async (ctx, args: ToggleArgs): Promise<Comment> => {
    const actor = requireActor(ctx);
    const { comment, post } = await findComment(ctx, args.commentId);
    requireRoot(comment);
    if (
      comment.author_id !== actor.id &&
      !canEdit(await postRoles(ctx, post, actor))
    )
      throw new FeedError(
        403,
        "게시물을 고칠 수 있는 사람이나 댓글 쓴 사람만 해결할 수 있습니다",
      );
    await ctx.db
      .updateTable("comments")
      .set({ resolved: args.on })
      .where("id", "=", comment.id)
      .execute();
    return one(ctx, post, actor, comment.id);
  },

  "comments.pin": async (ctx, args: ToggleArgs): Promise<Comment> => {
    const actor = requireActor(ctx);
    const { comment, post } = await findComment(ctx, args.commentId);
    requireRoot(comment);
    await requirePostEditor(ctx, post, actor);
    await ctx.db
      .updateTable("comments")
      .set({ pinned: args.on })
      .where("id", "=", comment.id)
      .execute();
    return one(ctx, post, actor, comment.id);
  },

  "comments.react": async (
    ctx,
    args: ToggleArgs & { emoji: string },
  ): Promise<Comment> => {
    const actor = requireActor(ctx);
    const { comment, post } = await findComment(ctx, args.commentId);
    requireLive(comment);
    if (args.on)
      await ctx.db
        .insertInto("reactions")
        .values({
          comment_id: comment.id,
          user_id: actor.id,
          emoji: args.emoji,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    else
      await ctx.db
        .deleteFrom("reactions")
        .where("comment_id", "=", comment.id)
        .where("user_id", "=", actor.id)
        .where("emoji", "=", args.emoji)
        .execute();
    return one(ctx, post, actor, comment.id);
  },

  "polls.vote": async (
    ctx,
    args: { pollId: string; optionIdx: number },
  ): Promise<Comment> => {
    const actor = requireActor(ctx);
    const poll = await ctx.db
      .selectFrom("polls")
      .selectAll()
      .where("id", "=", args.pollId)
      .executeTakeFirst();
    if (!poll) throw new FeedError(404, `모르는 투표입니다: ${args.pollId}`);
    const { comment, post } = await findComment(ctx, poll.comment_id);
    requireLive(comment);
    if (poll.closes_at && poll.closes_at.getTime() <= ctx.now.getTime())
      throw new FeedError(400, "마감된 투표입니다");
    if (args.optionIdx < 0 || args.optionIdx >= poll.options.length)
      throw new FeedError(400, "없는 선택지입니다");
    await ctx.db
      .insertInto("poll_votes")
      .values({
        poll_id: poll.id,
        user_id: actor.id,
        option_idx: args.optionIdx,
      })
      .onConflict((oc) =>
        oc
          .columns(["poll_id", "user_id"])
          .doUpdateSet({ option_idx: args.optionIdx }),
      )
      .execute();
    return one(ctx, post, actor, comment.id);
  },

  "attachments.add": async (
    ctx,
    args: {
      postId: string;
      kind: "file" | "link";
      name: string;
      url: string;
    },
  ): Promise<Attachment> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requirePostEditor(ctx, post, actor);
    const attachment: Attachment = {
      id: newId("a"),
      kind: args.kind,
      name: args.name,
      url: args.url,
    };
    await ctx.db
      .insertInto("attachments")
      .values({ ...attachment, post_id: post.id })
      .execute();
    await touch(ctx, post.id);
    return attachment;
  },

  "attachments.remove": async (
    ctx,
    args: { postId: string; attachmentId: string },
  ): Promise<void> => {
    const actor = requireActor(ctx);
    const post = await findPost(ctx, args.postId);
    await requirePostEditor(ctx, post, actor);
    const removed = await ctx.db
      .deleteFrom("attachments")
      .where("id", "=", args.attachmentId)
      .where("post_id", "=", post.id)
      .returning("id")
      .executeTakeFirst();
    if (!removed)
      throw new FeedError(404, `모르는 첨부입니다: ${args.attachmentId}`);
    await touch(ctx, post.id);
  },
});
