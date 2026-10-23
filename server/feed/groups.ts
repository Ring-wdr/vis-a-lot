// 피드 groups 모듈: 그룹 목록·설정, 멤버, 팀, 게시물 유형. 바꾸는 op는 그룹 관리자만 하고 바뀐 GroupDetail을 돌려준다.

import type {
  Group,
  GroupDetail,
  UpdateGroupRequest,
} from "../services/feed/modules/groups/schemas";
import {
  groupRole,
  requireGroupAdmin,
  resolveGroup,
  visibleGroupIds,
} from "./access";
import {
  defineOps,
  FeedError,
  newId,
  type OpCtx,
  requireActor,
} from "./context";
import type { GroupRole } from "./db";

/** 그룹 id들을 Group으로. 멤버 수·내 역할을 붙인다 */
async function toGroups(ctx: OpCtx, ids: string[]): Promise<Group[]> {
  if (ids.length === 0) return [];
  const rows = await ctx.db
    .selectFrom("groups")
    .select((eb) => [
      "id",
      "name",
      "key_prefix",
      "description",
      "is_private",
      "status_names",
      eb
        .selectFrom("group_members")
        .select((m) => m.fn.countAll<number>().as("n"))
        .whereRef("group_members.group_id", "=", "groups.id")
        .as("member_count"),
    ])
    .where("id", "in", ids)
    // 공개 그룹 먼저, 그다음 이름순. 화면은 첫 그룹을 기본 그룹(빠른 생성 등)으로 쓴다
    .orderBy("is_private")
    .orderBy("name")
    .orderBy("key_prefix")
    .execute();
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.key_prefix,
      description: r.description,
      isPrivate: r.is_private,
      statusNames: r.status_names,
      myRole: await groupRole(ctx, r.id),
      memberCount: Number(r.member_count ?? 0),
    })),
  );
}

/** 그룹 하나의 상세. 가시성은 부르는 쪽이 이미 확인했다 */
async function loadDetail(ctx: OpCtx, groupId: string): Promise<GroupDetail> {
  const [group] = await toGroups(ctx, [groupId]);
  if (!group) throw new FeedError(404, `모르는 그룹입니다: ${groupId}`);
  const members = await ctx.db
    .selectFrom("group_members")
    .select(["user_id", "role"])
    .where("group_id", "=", groupId)
    .execute();
  // 관리자 먼저, 그다음 userId 순
  members.sort((a, b) =>
    a.role !== b.role
      ? a.role === "admin"
        ? -1
        : 1
      : a.user_id.localeCompare(b.user_id),
  );
  const teams = await ctx.db
    .selectFrom("teams")
    .select(["id", "name"])
    .where("group_id", "=", groupId)
    .orderBy("name")
    .orderBy("id")
    .execute();
  const postTypes = await ctx.db
    .selectFrom("post_types")
    .select(["id", "name", "color", "sort"])
    .where("group_id", "=", groupId)
    .orderBy("sort")
    .orderBy("name")
    .execute();
  return {
    ...group,
    members: members.map((m) => ({ userId: m.user_id, role: m.role })),
    teams,
    postTypes,
  };
}

/** 그룹을 찾고 그룹 관리자인지 확인한다 */
async function adminGroup(ctx: OpCtx, idOrPrefix: string) {
  requireActor(ctx);
  const group = await resolveGroup(ctx, idOrPrefix);
  await requireGroupAdmin(ctx, group.id);
  return group;
}

async function adminCount(ctx: OpCtx, groupId: string) {
  const row = await ctx.db
    .selectFrom("group_members")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("group_id", "=", groupId)
    .where("role", "=", "admin")
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

async function memberRole(ctx: OpCtx, groupId: string, userId: string) {
  const row = await ctx.db
    .selectFrom("group_members")
    .select("role")
    .where("group_id", "=", groupId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return row?.role ?? null;
}

export const groupsOps = defineOps({
  "groups.list": async (ctx): Promise<{ groups: Group[] }> => {
    requireActor(ctx);
    return { groups: await toGroups(ctx, await visibleGroupIds(ctx)) };
  },

  "groups.get": async (
    ctx,
    args: { groupId: string },
  ): Promise<GroupDetail> => {
    requireActor(ctx);
    const group = await resolveGroup(ctx, args.groupId);
    return loadDetail(ctx, group.id);
  },

  "groups.update": async (
    ctx,
    args: { groupId: string; patch: UpdateGroupRequest },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    const { patch } = args;
    if (patch.keyPrefix !== undefined && patch.keyPrefix !== group.key_prefix) {
      const taken = await ctx.db
        .selectFrom("groups")
        .select("id")
        .where("key_prefix", "=", patch.keyPrefix)
        .where("id", "!=", group.id)
        .executeTakeFirst();
      if (taken)
        throw new FeedError(
          400,
          `이미 쓰는 키 접두사입니다: ${patch.keyPrefix}`,
        );
    }
    // 기존 게시물의 key는 만들 때 저장한 값이라 접두사를 바꿔도 그대로다
    const set = {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && {
        description: patch.description,
      }),
      ...(patch.isPrivate !== undefined && { is_private: patch.isPrivate }),
      ...(patch.keyPrefix !== undefined && { key_prefix: patch.keyPrefix }),
      ...(patch.statusNames !== undefined && {
        status_names: JSON.stringify(patch.statusNames),
      }),
    };
    if (Object.keys(set).length > 0)
      await ctx.db
        .updateTable("groups")
        .set(set)
        .where("id", "=", group.id)
        .execute();
    return loadDetail(ctx, group.id);
  },

  "groups.setMember": async (
    ctx,
    args: { groupId: string; userId: string; role: GroupRole },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    const user = await ctx.db
      .selectFrom("users")
      .select("id")
      .where("id", "=", args.userId)
      .executeTakeFirst();
    if (!user) throw new FeedError(404, `모르는 사용자입니다: ${args.userId}`);
    const current = await memberRole(ctx, group.id, args.userId);
    if (
      current === "admin" &&
      args.role !== "admin" &&
      (await adminCount(ctx, group.id)) <= 1
    )
      throw new FeedError(400, "마지막 그룹 관리자는 내릴 수 없습니다");
    await ctx.db
      .insertInto("group_members")
      .values({ group_id: group.id, user_id: args.userId, role: args.role })
      .onConflict((oc) =>
        oc.columns(["group_id", "user_id"]).doUpdateSet({ role: args.role }),
      )
      .execute();
    return loadDetail(ctx, group.id);
  },

  "groups.removeMember": async (
    ctx,
    args: { groupId: string; userId: string },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    const current = await memberRole(ctx, group.id, args.userId);
    if (!current) throw new FeedError(404, `멤버가 아닙니다: ${args.userId}`);
    if (current === "admin" && (await adminCount(ctx, group.id)) <= 1)
      throw new FeedError(400, "마지막 그룹 관리자는 뺄 수 없습니다");
    await ctx.db
      .deleteFrom("group_members")
      .where("group_id", "=", group.id)
      .where("user_id", "=", args.userId)
      .execute();
    return loadDetail(ctx, group.id);
  },

  "groups.saveTeam": async (
    ctx,
    args: { groupId: string; id?: string; name: string },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    if (args.id) {
      const res = await ctx.db
        .updateTable("teams")
        .set({ name: args.name })
        .where("id", "=", args.id)
        .where("group_id", "=", group.id)
        .executeTakeFirst();
      if (!res.numUpdatedRows)
        throw new FeedError(404, `모르는 팀입니다: ${args.id}`);
    } else
      await ctx.db
        .insertInto("teams")
        .values({ id: newId("t"), group_id: group.id, name: args.name })
        .execute();
    return loadDetail(ctx, group.id);
  },

  "groups.deleteTeam": async (
    ctx,
    args: { groupId: string; teamId: string },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    const team = await ctx.db
      .selectFrom("teams")
      .select("id")
      .where("id", "=", args.teamId)
      .where("group_id", "=", group.id)
      .executeTakeFirst();
    if (!team) throw new FeedError(404, `모르는 팀입니다: ${args.teamId}`);
    // 그 팀 게시물은 팀 없음으로
    await ctx.db
      .updateTable("posts")
      .set({ team_id: null })
      .where("team_id", "=", team.id)
      .execute();
    await ctx.db.deleteFrom("teams").where("id", "=", team.id).execute();
    return loadDetail(ctx, group.id);
  },

  "groups.savePostType": async (
    ctx,
    args: {
      groupId: string;
      id?: string;
      name: string;
      color: string | null;
      sort?: number;
    },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    if (args.id) {
      const res = await ctx.db
        .updateTable("post_types")
        .set({
          name: args.name,
          color: args.color,
          ...(args.sort !== undefined && { sort: args.sort }),
        })
        .where("id", "=", args.id)
        .where("group_id", "=", group.id)
        .executeTakeFirst();
      if (!res.numUpdatedRows)
        throw new FeedError(404, `모르는 게시물 유형입니다: ${args.id}`);
    } else {
      // sort를 안 주면 맨 뒤
      let sort = args.sort;
      if (sort === undefined) {
        const row = await ctx.db
          .selectFrom("post_types")
          .select((eb) => eb.fn.max("sort").as("max"))
          .where("group_id", "=", group.id)
          .executeTakeFirst();
        sort = row?.max == null ? 0 : Number(row.max) + 1;
      }
      await ctx.db
        .insertInto("post_types")
        .values({
          id: newId("pt"),
          group_id: group.id,
          name: args.name,
          color: args.color,
          sort,
        })
        .execute();
    }
    return loadDetail(ctx, group.id);
  },

  "groups.deletePostType": async (
    ctx,
    args: { groupId: string; postTypeId: string },
  ): Promise<GroupDetail> => {
    const group = await adminGroup(ctx, args.groupId);
    const postType = await ctx.db
      .selectFrom("post_types")
      .select("id")
      .where("id", "=", args.postTypeId)
      .where("group_id", "=", group.id)
      .executeTakeFirst();
    if (!postType)
      throw new FeedError(404, `모르는 게시물 유형입니다: ${args.postTypeId}`);
    // 그 유형 게시물은 유형 없음으로
    await ctx.db
      .updateTable("posts")
      .set({ post_type_id: null })
      .where("post_type_id", "=", postType.id)
      .execute();
    await ctx.db
      .deleteFrom("post_types")
      .where("id", "=", postType.id)
      .execute();
    return loadDetail(ctx, group.id);
  },
});
