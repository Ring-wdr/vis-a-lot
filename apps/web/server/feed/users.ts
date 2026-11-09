// 피드 users 모듈: 사용자 목록, 지금 사용자, 시스템 관리자 지정, 비활성화, 관심(팔로우).

import type { PostRef } from "../services/feed/modules/common";
import type {
  DeactivateResponse,
  FeedUser,
  Me,
} from "../services/feed/modules/users/schemas";
import { requireSystemAdmin } from "./access";
import { defineOps, FeedError, type OpCtx, requireActor } from "./context";
import type { PostStatus } from "./db";

/** 열림 카테고리 상태 */
const OPEN_STATUSES: PostStatus[] = ["unresolved", "in_progress", "in_review"];

function toUser(row: {
  id: string;
  name: string;
  email: string | null;
  is_admin: boolean;
  active: boolean;
}): FeedUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: row.is_admin,
    active: row.active,
  };
}

async function findUser(ctx: OpCtx, userId: string): Promise<FeedUser> {
  const row = await ctx.db
    .selectFrom("users")
    .select(["id", "name", "email", "is_admin", "active"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!row) throw new FeedError(404, `모르는 사용자입니다: ${userId}`);
  return toUser(row);
}

export const usersOps = defineOps({
  "users.list": async (ctx): Promise<{ users: FeedUser[] }> => {
    const rows = await ctx.db
      .selectFrom("users")
      .select(["id", "name", "email", "is_admin", "active"])
      .orderBy("id")
      .execute();
    return { users: rows.map(toUser) };
  },

  "users.me": async (ctx): Promise<Me> => {
    const actor = requireActor(ctx);
    const user = await findUser(ctx, actor.id);
    const follows = await ctx.db
      .selectFrom("user_follows")
      .select("followee_id")
      .where("follower_id", "=", actor.id)
      .orderBy("followee_id")
      .execute();
    return { ...user, following: follows.map((r) => r.followee_id) };
  },

  "users.setAdmin": async (
    ctx,
    args: { userId: string; on: boolean },
  ): Promise<FeedUser> => {
    const actor = requireActor(ctx);
    requireSystemAdmin(ctx);
    const user = await findUser(ctx, args.userId);
    // 마지막 시스템 관리자가 스스로 해제하면 관리 콘솔에 아무도 못 들어온다
    if (!args.on && user.isAdmin && user.id === actor.id) {
      const row = await ctx.db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("is_admin", "=", true)
        .where("active", "=", true)
        .executeTakeFirstOrThrow();
      if (Number(row.n) <= 1)
        throw new FeedError(400, "마지막 시스템 관리자는 해제할 수 없습니다");
    }
    await ctx.db
      .updateTable("users")
      .set({ is_admin: args.on })
      .where("id", "=", user.id)
      .execute();
    return { ...user, isAdmin: args.on };
  },

  "users.deactivate": async (
    ctx,
    args: { userId: string },
  ): Promise<DeactivateResponse> => {
    const actor = requireActor(ctx);
    requireSystemAdmin(ctx);
    const user = await findUser(ctx, args.userId);
    if (user.id === actor.id)
      throw new FeedError(400, "자기 자신은 비활성화할 수 없습니다");
    await ctx.db
      .updateTable("users")
      .set({ active: false })
      .where("id", "=", user.id)
      .execute();
    // 담당·요청 중인 열린 게시물 (재배정 안내용)
    const rows = await ctx.db
      .selectFrom("posts")
      .select(["id", "key", "title", "status", "group_id"])
      .where("deleted_at", "is", null)
      .where("status", "in", OPEN_STATUSES)
      .where((eb) =>
        eb.or([
          eb("assignee_id", "=", user.id),
          eb("requester_id", "=", user.id),
        ]),
      )
      .orderBy("key")
      .execute();
    const openPosts: PostRef[] = rows.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      status: r.status,
      groupId: r.group_id,
    }));
    return { user: { ...user, active: false }, openPosts };
  },

  "users.follow": async (
    ctx,
    args: { userId: string; on: boolean },
  ): Promise<{ following: boolean }> => {
    const actor = requireActor(ctx);
    if (args.userId === actor.id)
      throw new FeedError(400, "자기 자신은 관심 등록할 수 없습니다");
    await findUser(ctx, args.userId);
    if (args.on)
      await ctx.db
        .insertInto("user_follows")
        .values({ follower_id: actor.id, followee_id: args.userId })
        .onConflict((oc) => oc.doNothing())
        .execute();
    else
      await ctx.db
        .deleteFrom("user_follows")
        .where("follower_id", "=", actor.id)
        .where("followee_id", "=", args.userId)
        .execute();
    return { following: args.on };
  },
});
