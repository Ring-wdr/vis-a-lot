// 피드 views 모듈: 저장된 뷰와 기본 제공 뷰(탐색·관심).
// 보기: 내 뷰 + 볼 수 있는 그룹의 공유 뷰. 고치기: 만든 사람, 또는 공유 뷰면 그 그룹 관리자.

import type { Selectable } from "kysely";
import type {
  SavedView,
  SaveViewRequest,
} from "../services/feed/modules/views/schemas";
import { groupRole, groupRoles, resolveGroup, visibleGroupIds } from "./access";
import {
  type Actor,
  defineOps,
  FeedError,
  newId,
  type OpCtx,
  requireActor,
} from "./context";
import type { SavedViewsTable } from "./db";

type ViewRow = Selectable<SavedViewsTable>;
type ViewArgs = { viewId: string };

const builtin = (
  id: string,
  name: string,
  filter: SavedView["filter"],
): SavedView => ({
  id,
  ownerId: null,
  groupId: null,
  name,
  shared: false,
  layout: "feed",
  filter,
  sort: { field: "updatedAt", dir: "desc" },
  groupBy: null,
  pinned: true,
  builtin: true,
  editable: false,
});

/** 기본 제공 뷰. DB에 두지 않고 목록 맨 앞에 붙인다 */
const BUILTIN_VIEWS: SavedView[] = [
  builtin("builtin-explore", "탐색", {}),
  builtin("builtin-following", "관심", { followedAuthors: true }),
];

const isBuiltinId = (id: string) => id.startsWith("builtin-");

/** 지금 사용자의 그룹 역할. 목록은 뷰마다 묻지 않고 한 번만 읽어 넘긴다 */
type RoleOf = Awaited<ReturnType<typeof groupRoles>>;

function canEditRow(actor: Actor, row: ViewRow, roleOf: RoleOf) {
  if (row.owner_id === actor.id) return true;
  return row.shared && row.group_id != null
    ? roleOf(row.group_id) === "admin"
    : false;
}

async function toView(
  ctx: OpCtx,
  actor: Actor,
  row: ViewRow,
  roleOf?: RoleOf,
): Promise<SavedView> {
  roleOf ??= await groupRoles(ctx, actor);
  return {
    id: row.id,
    ownerId: row.owner_id,
    groupId: row.group_id,
    name: row.name,
    shared: row.shared,
    layout: row.layout,
    filter: (row.filter ?? {}) as SavedView["filter"],
    sort: (row.sort ?? null) as SavedView["sort"],
    groupBy: (row.group_by ?? null) as SavedView["groupBy"],
    pinned: row.pinned,
    builtin: false,
    editable: canEditRow(actor, row, roleOf),
  };
}

/** 내 뷰이거나 볼 수 있는 그룹의 공유 뷰 */
async function canSeeRow(ctx: OpCtx, actor: Actor, row: ViewRow) {
  if (row.owner_id === actor.id) return true;
  if (!row.shared || row.group_id == null) return false;
  return (await visibleGroupIds(ctx)).includes(row.group_id);
}

/** 볼 수 없는 뷰는 없는 것처럼 404 */
async function findView(ctx: OpCtx, actor: Actor, viewId: string) {
  const row = await ctx.db
    .selectFrom("saved_views")
    .selectAll()
    .where("id", "=", viewId)
    .executeTakeFirst();
  if (!row || !(await canSeeRow(ctx, actor, row)))
    throw new FeedError(404, `모르는 뷰입니다: ${viewId}`);
  return row;
}

async function findEditable(ctx: OpCtx, actor: Actor, viewId: string) {
  if (isBuiltinId(viewId))
    throw new FeedError(403, "기본 제공 뷰는 고칠 수 없습니다");
  const row = await findView(ctx, actor, viewId);
  if (!canEditRow(actor, row, await groupRoles(ctx, actor)))
    throw new FeedError(403, "이 뷰를 고칠 권한이 없습니다");
  return row;
}

const byPinnedThenName = (a: SavedView, b: SavedView) =>
  Number(b.pinned) - Number(a.pinned) ||
  a.name.localeCompare(b.name, "ko") ||
  a.id.localeCompare(b.id);

export const viewsOps = defineOps({
  "views.list": async (
    ctx,
    args: { groupId?: string } = {},
  ): Promise<{ views: SavedView[] }> => {
    const actor = requireActor(ctx);
    const group = args.groupId ? await resolveGroup(ctx, args.groupId) : null;
    const visible = await visibleGroupIds(ctx);
    let query = ctx.db.selectFrom("saved_views").selectAll();
    if (group)
      query = query.where((eb) =>
        eb.or([
          eb.and([
            eb("group_id", "=", group.id),
            eb.or([eb("owner_id", "=", actor.id), eb("shared", "=", true)]),
          ]),
          eb.and([eb("owner_id", "=", actor.id), eb("group_id", "is", null)]),
        ]),
      );
    else
      query = query.where((eb) =>
        eb.or([
          eb("owner_id", "=", actor.id),
          visible.length > 0
            ? eb.and([eb("shared", "=", true), eb("group_id", "in", visible)])
            : eb.val(false),
        ]),
      );
    const rows = await query.execute();
    const roleOf = await groupRoles(ctx, actor);
    const rest: SavedView[] = [];
    for (const row of rows) rest.push(await toView(ctx, actor, row, roleOf));
    rest.sort(byPinnedThenName);
    return { views: [...BUILTIN_VIEWS, ...rest] };
  },

  "views.get": async (ctx, args: ViewArgs): Promise<SavedView> => {
    const actor = requireActor(ctx);
    const found = BUILTIN_VIEWS.find((v) => v.id === args.viewId);
    if (found) return found;
    return toView(ctx, actor, await findView(ctx, actor, args.viewId));
  },

  "views.save": async (ctx, args: SaveViewRequest): Promise<SavedView> => {
    const actor = requireActor(ctx);
    const shared = args.shared ?? false;
    if (shared && !args.groupId)
      throw new FeedError(400, "공유 뷰는 그룹을 골라야 합니다");
    const group = args.groupId ? await resolveGroup(ctx, args.groupId) : null;
    if (shared && group && (await groupRole(ctx, group.id)) === null)
      throw new FeedError(403, "그룹 멤버만 공유 뷰를 만들 수 있습니다");
    const values = {
      group_id: group?.id ?? null,
      name: args.name,
      shared,
      layout: args.layout,
      filter: JSON.stringify(args.filter ?? {}),
      sort: args.sort ? JSON.stringify(args.sort) : null,
      group_by: args.groupBy ?? null,
      pinned: args.pinned ?? false,
    };
    if (args.id) {
      const row = await findEditable(ctx, actor, args.id);
      await ctx.db
        .updateTable("saved_views")
        .set(values)
        .where("id", "=", row.id)
        .execute();
      return toView(ctx, actor, await findView(ctx, actor, row.id));
    }
    const id = newId("v");
    await ctx.db
      .insertInto("saved_views")
      .values({ id, owner_id: actor.id, ...values })
      .execute();
    return toView(ctx, actor, await findView(ctx, actor, id));
  },

  "views.delete": async (ctx, args: ViewArgs): Promise<void> => {
    const actor = requireActor(ctx);
    const row = await findEditable(ctx, actor, args.viewId);
    await ctx.db.deleteFrom("saved_views").where("id", "=", row.id).execute();
  },

  "views.pin": async (
    ctx,
    args: ViewArgs & { on: boolean },
  ): Promise<SavedView> => {
    const actor = requireActor(ctx);
    const row = await findEditable(ctx, actor, args.viewId);
    await ctx.db
      .updateTable("saved_views")
      .set({ pinned: args.on })
      .where("id", "=", row.id)
      .execute();
    return toView(ctx, actor, { ...row, pinned: args.on });
  },
});
