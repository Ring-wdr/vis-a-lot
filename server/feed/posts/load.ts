// 게시물 찾기·역할·입력 검증. op마다 같은 규칙으로 404·400을 낸다.

import type { Selectable } from "kysely";
import type { PostRef } from "../../services/feed/modules/common";
import { canSeeGroup, groupRole } from "../access";
import { type Actor, FeedError, type OpCtx } from "../context";
import type { PostsTable } from "../db";
import type { PostRoles } from "./workflow";

export type PostRow = Selectable<PostsTable>;

/** id 또는 이슈 키(FD-12)로 찾는다. 없거나 지웠거나 볼 수 없으면 404 */
export async function findPost(ctx: OpCtx, idOrKey: string): Promise<PostRow> {
  const post = await ctx.db
    .selectFrom("posts")
    .selectAll()
    .where((eb) => eb.or([eb("id", "=", idOrKey), eb("key", "=", idOrKey)]))
    .where("deleted_at", "is", null)
    .executeTakeFirst();
  if (post) {
    const group = await ctx.db
      .selectFrom("groups")
      .select(["id", "is_private"])
      .where("id", "=", post.group_id)
      .executeTakeFirstOrThrow();
    if (await canSeeGroup(ctx, group)) return post;
  }
  throw new FeedError(404, `모르는 게시물입니다: ${idOrKey}`);
}

export async function postRoles(
  ctx: OpCtx,
  post: PostRow,
  actor: Actor,
): Promise<PostRoles> {
  const stakeholder = await ctx.db
    .selectFrom("post_stakeholders")
    .select("user_id")
    .where("post_id", "=", post.id)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();
  const author = post.author_id === actor.id;
  const requester = post.requester_id === actor.id;
  return {
    author,
    assignee: post.assignee_id === actor.id,
    requester,
    stakeholder: !!stakeholder,
    admin: (await groupRole(ctx, post.group_id, actor)) === "admin",
    reviewer: post.requester_id ? requester : author,
  };
}

/** 담당자·요청자·이해관계자는 활성 사용자여야 한다 */
export async function assertActiveUsers(
  ctx: OpCtx,
  ids: (string | null | undefined)[],
) {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return;
  const found = await ctx.db
    .selectFrom("users")
    .select("id")
    .where("id", "in", wanted)
    .where("active", "=", true)
    .execute();
  const ok = new Set(found.map((u) => u.id));
  const missing = wanted.find((id) => !ok.has(id));
  if (missing) throw new FeedError(400, `모르는 사용자입니다: ${missing}`);
}

/** 팀·게시물 유형은 게시물과 같은 그룹 것이어야 한다 */
export async function assertInGroup(
  ctx: OpCtx,
  groupId: string,
  refs: { teamId?: string | null; postTypeId?: string | null },
) {
  if (refs.teamId) {
    const team = await ctx.db
      .selectFrom("teams")
      .select("id")
      .where("id", "=", refs.teamId)
      .where("group_id", "=", groupId)
      .executeTakeFirst();
    if (!team) throw new FeedError(400, `그룹에 없는 팀입니다: ${refs.teamId}`);
  }
  if (refs.postTypeId) {
    const type = await ctx.db
      .selectFrom("post_types")
      .select("id")
      .where("id", "=", refs.postTypeId)
      .where("group_id", "=", groupId)
      .executeTakeFirst();
    if (!type)
      throw new FeedError(
        400,
        `그룹에 없는 게시물 유형입니다: ${refs.postTypeId}`,
      );
  }
}

/** 자동 구독. 이미 있는 행(끈 구독 포함)은 그대로 둔다 */
export async function autoSubscribe(
  ctx: OpCtx,
  postId: string,
  userIds: (string | null | undefined)[],
) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  await ctx.db
    .insertInto("post_subscribers")
    .values(ids.map((user_id) => ({ post_id: postId, user_id })))
    .onConflict((oc) => oc.columns(["post_id", "user_id"]).doNothing())
    .execute();
}

export function toRef(
  row: Pick<PostRow, "id" | "key" | "title" | "status" | "group_id">,
): PostRef {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    status: row.status,
    groupId: row.group_id,
  };
}
