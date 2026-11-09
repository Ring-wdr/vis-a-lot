// 진행률 자동 계산. 하위·체크리스트가 바뀐 뒤 불러서 값이 바뀌면 progress 이력을 남긴다.

import type { OpCtx } from "../context";
import { recordEvent } from "../events";
import { autoProgress, CLOSED_STATUSES } from "./workflow";

async function progressBase(ctx: OpCtx, postId: string) {
  const children = await ctx.db
    .selectFrom("posts")
    .select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn
        .countAll<number>()
        .filterWhere("status", "in", CLOSED_STATUSES)
        .as("done"),
    ])
    .where("parent_id", "=", postId)
    .where("deleted_at", "is", null)
    .executeTakeFirstOrThrow();
  const checklist = await ctx.db
    .selectFrom("checklist_items")
    .select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn.countAll<number>().filterWhere("done", "=", true).as("done"),
    ])
    .where("post_id", "=", postId)
    .executeTakeFirstOrThrow();
  return {
    children: { total: Number(children.total), done: Number(children.done) },
    checklist: { total: Number(checklist.total), done: Number(checklist.done) },
  };
}

/** 하위나 체크리스트가 있으면 진행률을 직접 바꿀 수 없다 */
export async function hasAutoProgress(ctx: OpCtx, postId: string) {
  const base = await progressBase(ctx, postId);
  return autoProgress(base.children, base.checklist) !== null;
}

/** 자동 진행률을 다시 계산한다. 하위·체크리스트가 없으면(수동) 그대로 둔다 */
export async function recomputeProgress(ctx: OpCtx, postId: string | null) {
  if (!postId) return;
  const post = await ctx.db
    .selectFrom("posts")
    .select(["progress", "deleted_at"])
    .where("id", "=", postId)
    .executeTakeFirst();
  if (!post || post.deleted_at) return;
  const base = await progressBase(ctx, postId);
  const value = autoProgress(base.children, base.checklist);
  if (value === null || value === post.progress) return;
  await ctx.db
    .updateTable("posts")
    .set({ progress: value, updated_at: ctx.now })
    .where("id", "=", postId)
    .execute();
  await recordEvent(ctx, {
    postId,
    kind: "progress",
    oldValue: String(post.progress),
    newValue: String(value),
  });
}
