// 댓글 행 → API 모양(Comment·CommentThread). 반응·투표는 댓글 수와 상관없이 쿼리 몇 번으로 모은다.

import type { Selectable } from "kysely";
import type {
  Comment,
  CommentThread,
  Poll,
} from "../../services/feed/modules/comments/schemas";
import type { Actor, OpCtx } from "../context";
import type { CommentsTable } from "../db";
import { type PostRow, postRoles } from "../posts/load";
import { canEdit } from "../posts/workflow";
import { iso } from "../time";
import { mentionIds } from "./mentions";

export type CommentRow = Selectable<CommentsTable>;

const byTime = (a: CommentRow, b: CommentRow) =>
  a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id);

/** rows를 같은 순서로 API 모양으로. 모두 post의 댓글이어야 한다 */
export async function toComments(
  ctx: OpCtx,
  post: PostRow,
  actor: Actor,
  rows: CommentRow[],
): Promise<Comment[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [roles, reactions, polls] = await Promise.all([
    postRoles(ctx, post, actor),
    ctx.db
      .selectFrom("reactions")
      .select(["comment_id", "user_id", "emoji"])
      .where("comment_id", "in", ids)
      .execute(),
    ctx.db
      .selectFrom("polls")
      .selectAll()
      .where("comment_id", "in", ids)
      .execute(),
  ]);
  const votes = polls.length
    ? await ctx.db
        .selectFrom("poll_votes")
        .select(["poll_id", "user_id", "option_idx"])
        .where(
          "poll_id",
          "in",
          polls.map((p) => p.id),
        )
        .execute()
    : [];

  // 반응: 처음 누른 순서대로 이모지별로 센다
  const reactionsOf = new Map<string, Map<string, Comment["reactions"][0]>>();
  for (const r of reactions) {
    const map = reactionsOf.get(r.comment_id) ?? new Map();
    reactionsOf.set(r.comment_id, map);
    const item = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    item.count++;
    if (r.user_id === actor.id) item.mine = true;
    map.set(r.emoji, item);
  }
  const pollOf = new Map<string, Poll>();
  for (const p of polls) {
    const counts = p.options.map(() => 0);
    let myVote: number | null = null;
    for (const v of votes) {
      if (v.poll_id !== p.id) continue;
      if (v.option_idx >= 0 && v.option_idx < counts.length)
        counts[v.option_idx]++;
      if (v.user_id === actor.id) myVote = v.option_idx;
    }
    pollOf.set(p.comment_id, {
      id: p.id,
      question: p.question,
      options: p.options,
      closesAt: iso(p.closes_at),
      votes: counts,
      myVote,
      closed: !!p.closes_at && p.closes_at.getTime() <= ctx.now.getTime(),
    });
  }

  const editor = canEdit(roles);
  return rows.map((r) => {
    const deleted = !!r.deleted_at;
    const author = r.author_id === actor.id;
    const root = r.parent_id === null;
    return {
      id: r.id,
      postId: r.post_id,
      authorId: r.author_id,
      parentId: r.parent_id,
      body: deleted ? null : (r.body ?? null),
      resolved: r.resolved,
      pinned: r.pinned,
      deleted,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      mentions: deleted ? [] : mentionIds(r.body),
      reactions: deleted ? [] : [...(reactionsOf.get(r.id)?.values() ?? [])],
      poll: deleted ? null : (pollOf.get(r.id) ?? null),
      permissions: {
        edit: !deleted && author,
        delete: !deleted && (author || roles.admin),
        resolve: root && (editor || author),
        pin: root && editor,
      },
    };
  });
}

/**
 * 게시물의 스레드. 고정한 스레드 먼저, 그다음 오래된 순. 대댓글은 오래된 순.
 * 지운 댓글은 빼되, 지운 첫 댓글에 살아 있는 대댓글이 있으면 자리를 남긴다.
 */
export async function loadThreads(
  ctx: OpCtx,
  post: PostRow,
  actor: Actor,
): Promise<CommentThread[]> {
  const rows = await ctx.db
    .selectFrom("comments")
    .selectAll()
    .where("post_id", "=", post.id)
    .execute();
  rows.sort(byTime);
  const replies = new Map<string, CommentRow[]>();
  for (const r of rows)
    if (r.parent_id && !r.deleted_at)
      replies.set(r.parent_id, [...(replies.get(r.parent_id) ?? []), r]);
  const roots = rows
    .filter((r) => r.parent_id === null && (!r.deleted_at || replies.has(r.id)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || byTime(a, b));
  const visible = roots.flatMap((r) => [r, ...(replies.get(r.id) ?? [])]);
  const mapped = new Map(
    (await toComments(ctx, post, actor, visible)).map((c) => [c.id, c]),
  );
  const pick = (r: CommentRow) => {
    const c = mapped.get(r.id);
    return c ? [c] : [];
  };
  return roots.flatMap((r) =>
    pick(r).map((c) => ({
      ...c,
      replies: (replies.get(r.id) ?? []).flatMap(pick),
    })),
  );
}
