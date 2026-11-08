// 그룹 권한과 가시성. 시스템 관리자는 모든 그룹에서 그룹 관리자이고, 비공개 그룹은 멤버(와 시스템 관리자)만 본다.

import { type Actor, FeedError, type OpCtx } from "./context";
import type { GroupRole } from "./db";

export type GroupRow = {
  id: string;
  name: string;
  key_prefix: string;
  is_private: boolean;
};

/** 그룹 id 또는 키 접두사(FD)로 찾는다. 없거나 볼 수 없으면 404 */
export async function resolveGroup(
  ctx: OpCtx,
  idOrPrefix: string,
): Promise<GroupRow> {
  const group = await ctx.db
    .selectFrom("groups")
    .select(["id", "name", "key_prefix", "is_private"])
    .where((eb) =>
      eb.or([eb("id", "=", idOrPrefix), eb("key_prefix", "=", idOrPrefix)]),
    )
    .executeTakeFirst();
  if (!group || !(await canSeeGroup(ctx, group)))
    throw new FeedError(404, `모르는 그룹입니다: ${idOrPrefix}`);
  return group;
}

/** 지금 사용자의 그룹 역할. 시스템 관리자는 멤버가 아니어도 'admin' */
export async function groupRole(
  ctx: OpCtx,
  groupId: string,
  actor: Actor | null = ctx.actor,
): Promise<GroupRole | null> {
  if (!actor) return null;
  if (actor.isAdmin) return "admin";
  const row = await ctx.db
    .selectFrom("group_members")
    .select("role")
    .where("group_id", "=", groupId)
    .where("user_id", "=", actor.id)
    .executeTakeFirst();
  return row?.role ?? null;
}

/**
 * 여러 그룹의 역할을 한 번에 읽는다 (목록에서 그룹마다 groupRole을 부르지 않게).
 * 돌려준 함수는 groupRole과 같은 값을 낸다.
 */
export async function groupRoles(
  ctx: OpCtx,
  actor: Actor | null = ctx.actor,
): Promise<(groupId: string) => GroupRole | null> {
  if (!actor) return () => null;
  if (actor.isAdmin) return () => "admin";
  const rows = await ctx.db
    .selectFrom("group_members")
    .select(["group_id", "role"])
    .where("user_id", "=", actor.id)
    .execute();
  const roles = new Map(rows.map((r) => [r.group_id, r.role]));
  return (groupId) => roles.get(groupId) ?? null;
}

export async function canSeeGroup(
  ctx: OpCtx,
  group: Pick<GroupRow, "id" | "is_private">,
) {
  if (!group.is_private) return true;
  return (await groupRole(ctx, group.id)) !== null;
}

export async function isGroupAdmin(ctx: OpCtx, groupId: string) {
  return (await groupRole(ctx, groupId)) === "admin";
}

export async function requireGroupAdmin(ctx: OpCtx, groupId: string) {
  if (!(await isGroupAdmin(ctx, groupId)))
    throw new FeedError(403, "그룹 관리자만 할 수 있습니다");
}

export function requireSystemAdmin(ctx: OpCtx) {
  if (!ctx.actor?.isAdmin)
    throw new FeedError(403, "시스템 관리자만 할 수 있습니다");
}

/** 지금 사용자가 볼 수 있는 그룹 id 목록 (목록 조회의 기본 범위) */
export async function visibleGroupIds(ctx: OpCtx): Promise<string[]> {
  const actor = ctx.actor;
  let query = ctx.db.selectFrom("groups").select("id");
  if (!actor?.isAdmin)
    query = query.where((eb) =>
      eb.or([
        eb("is_private", "=", false),
        eb(
          "id",
          "in",
          eb
            .selectFrom("group_members")
            .select("group_id")
            .where("user_id", "=", actor?.id ?? ""),
        ),
      ]),
    );
  return (await query.execute()).map((r) => r.id);
}
