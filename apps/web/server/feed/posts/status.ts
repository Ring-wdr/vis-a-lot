// 상태 전이 실행. 규칙은 ./workflow, 여기서는 검사 → 쓰기 → 이력 → 뒤따르는 변화(차단 해제·상위 진행률·상위 검토 중).

import type { Updateable } from "kysely";
import { type Actor, FeedError, newId, type OpCtx } from "../context";
import type { PostStatus, PostsTable } from "../db";
import { recordEvent } from "../events";
import { type PostRow, postRoles } from "./load";
import { recomputeProgress } from "./progress";
import {
  CANCEL_REASONS,
  CLOSED_STATUSES,
  canTransition,
  categoryOf,
  HOLD_REASONS,
  STATUS_LABEL,
  type TransitionKind,
  transitionKind,
  transitionViaMove,
} from "./workflow";

export type TransitionInput = {
  to: PostStatus;
  reason?: string;
  holdUntil?: string;
  /** 반려 댓글 */
  comment?: string;
};

/**
 * 전이 하나. expected가 있으면 그 전이만(requestReview·approve·reject·reopen op),
 * 없으면 transition(보드 드래그) 규칙. 규칙에 없으면 409, 권한이 없으면 403, 사유가 틀리면 400
 */
export async function changeStatus(
  ctx: OpCtx,
  actor: Actor,
  post: PostRow,
  input: TransitionInput,
  expected?: TransitionKind,
) {
  const { to } = input;
  const kind = expected
    ? transitionKind(post.status, to)
    : transitionViaMove(post.status, to);
  if (!kind || (expected && kind !== expected))
    throw new FeedError(
      409,
      `${STATUS_LABEL[post.status]} 상태에서 ${STATUS_LABEL[to]}(으)로 바꿀 수 없습니다`,
    );
  if (!canTransition(kind, await postRoles(ctx, post, actor)))
    throw new FeedError(403, `${STATUS_LABEL[to]}(으)로 바꿀 권한이 없습니다`);

  const set: Updateable<PostsTable> = { status: to, updated_at: ctx.now };
  switch (kind) {
    case "approve":
      set.resolved_at = ctx.now;
      set.close_reason = null;
      break;
    case "hold":
      if (!input.reason || !HOLD_REASONS.includes(input.reason))
        throw new FeedError(
          400,
          "보류 사유를 고르세요 (의존성·의사결정·리소스 대기)",
        );
      if (!input.holdUntil) throw new FeedError(400, "재개일을 정하세요");
      set.close_reason = input.reason;
      set.hold_until = input.holdUntil;
      break;
    case "cancel":
      if (!input.reason || !CANCEL_REASONS.includes(input.reason))
        throw new FeedError(
          400,
          "취소 사유를 고르세요 (중복·재현 안 됨·범위 밖·우선순위 낮음)",
        );
      set.close_reason = input.reason;
      set.hold_until = null;
      break;
    case "resume":
      set.close_reason = null;
      set.hold_until = null;
      break;
    case "reopen":
      set.reopen_count = post.reopen_count + 1;
      set.resolved_at = null;
      set.close_reason = null;
      set.hold_until = null;
      break;
    case "reject":
      if (!input.comment?.trim())
        throw new FeedError(400, "반려 사유를 댓글로 남기세요");
      break;
  }

  await ctx.db
    .updateTable("posts")
    .set(set)
    .where("id", "=", post.id)
    .execute();
  await recordEvent(ctx, {
    postId: post.id,
    kind: "status",
    oldValue: post.status,
    newValue: to,
  });
  switch (kind) {
    case "requestReview":
      await recordEvent(ctx, { postId: post.id, kind: "review_requested" });
      break;
    case "approve":
      await recordEvent(ctx, { postId: post.id, kind: "approved" });
      break;
    case "reject": {
      const commentId = newId("c");
      const text = input.comment?.trim() ?? "";
      await ctx.db
        .insertInto("comments")
        .values({
          id: commentId,
          post_id: post.id,
          author_id: actor.id,
          body: JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          }),
          created_at: ctx.now,
        })
        .execute();
      await recordEvent(ctx, { postId: post.id, kind: "rejected", commentId });
      break;
    }
    case "reopen":
      await recordEvent(ctx, { postId: post.id, kind: "reopened" });
      break;
  }
  await afterStatusChange(ctx, post, to);
}

/** 상태가 바뀐 뒤: 닫히면 막고 있던 게시물의 차단 해제, 상위 진행률, 하위가 다 끝나면 상위를 검토 중으로 */
async function afterStatusChange(ctx: OpCtx, post: PostRow, to: PostStatus) {
  const closedNow =
    categoryOf(to) === "closed" && categoryOf(post.status) !== "closed";
  if (closedNow) await notifyUnblocked(ctx, post);
  if (!post.parent_id) return;
  await recomputeProgress(ctx, post.parent_id);
  if (closedNow) await reviewParentIfDone(ctx, post.parent_id);
}

/** 이 게시물이 막던 게시물 중 다른 열린 차단이 없는 것에 unblocked 이력 */
async function notifyUnblocked(ctx: OpCtx, post: PostRow) {
  const postId = post.id;
  const targets = await ctx.db
    .selectFrom("post_relations as r")
    .innerJoin("posts as t", "t.id", "r.to_id")
    .select("t.id")
    .where("r.from_id", "=", postId)
    .where("r.kind", "=", "blocks")
    .where("t.deleted_at", "is", null)
    .where("t.status", "not in", CLOSED_STATUSES)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("post_relations as o")
            .innerJoin("posts as b", "b.id", "o.from_id")
            .select("b.id")
            .whereRef("o.to_id", "=", "t.id")
            .where("o.kind", "=", "blocks")
            .where("o.from_id", "!=", postId)
            .where("b.deleted_at", "is", null)
            .where("b.status", "not in", CLOSED_STATUSES),
        ),
      ),
    )
    .execute();
  for (const t of targets)
    await recordEvent(ctx, {
      postId: t.id,
      kind: "unblocked",
      newValue: post.key,
    });
}

/** 하위가 모두 끝났고(취소 포함, 해결 하나 이상) 상위가 미해결·진행 중이면 상위를 검토 중으로 */
async function reviewParentIfDone(ctx: OpCtx, parentId: string) {
  const parent = await ctx.db
    .selectFrom("posts")
    .select(["id", "status", "deleted_at"])
    .where("id", "=", parentId)
    .executeTakeFirst();
  if (
    !parent ||
    parent.deleted_at ||
    !(["unresolved", "in_progress"] as PostStatus[]).includes(parent.status)
  )
    return;
  const children = await ctx.db
    .selectFrom("posts")
    .select("status")
    .where("parent_id", "=", parentId)
    .where("deleted_at", "is", null)
    .execute();
  const done = children.every((c) => CLOSED_STATUSES.includes(c.status));
  if (!done || !children.some((c) => c.status === "resolved")) return;
  await ctx.db
    .updateTable("posts")
    .set({ status: "in_review", updated_at: ctx.now })
    .where("id", "=", parentId)
    .execute();
  await recordEvent(ctx, {
    postId: parentId,
    kind: "status",
    oldValue: parent.status,
    newValue: "in_review",
  });
  await recordEvent(ctx, { postId: parentId, kind: "children_resolved" });
}
