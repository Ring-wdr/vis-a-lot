// 보고 템플릿. 보기: 그룹을 볼 수 있는 사람. 만들기: 그룹 멤버. 고치기·지우기: 만든 사람 또는 그룹 관리자.

import type { Selectable } from "kysely";
import type {
  ReportTemplate,
  SaveReportTemplateRequest,
} from "../../services/feed/modules/reports/schemas";
import { canSeeGroup, groupRole, resolveGroup } from "../access";
import {
  type Actor,
  FeedError,
  newId,
  type OpCtx,
  requireActor,
} from "../context";
import type { ReportTemplatesTable } from "../db";
import { assertActiveUsers, assertInGroup } from "../posts/load";

type TemplateRow = Selectable<ReportTemplatesTable>;

async function canEditRow(ctx: OpCtx, actor: Actor, row: TemplateRow) {
  return (
    row.owner_id === actor.id ||
    (await groupRole(ctx, row.group_id, actor)) === "admin"
  );
}

async function toTemplate(
  ctx: OpCtx,
  actor: Actor,
  row: TemplateRow,
): Promise<ReportTemplate> {
  return {
    id: row.id,
    ownerId: row.owner_id,
    groupId: row.group_id,
    name: row.name,
    kind: row.kind,
    params: (row.params ?? {}) as ReportTemplate["params"],
    editable: await canEditRow(ctx, actor, row),
  };
}

/** 없거나 그룹을 볼 수 없으면 404 */
async function findTemplate(ctx: OpCtx, templateId: string) {
  const row = await ctx.db
    .selectFrom("report_templates")
    .selectAll()
    .where("id", "=", templateId)
    .executeTakeFirst();
  if (row) {
    const group = await ctx.db
      .selectFrom("groups")
      .select(["id", "is_private"])
      .where("id", "=", row.group_id)
      .executeTakeFirstOrThrow();
    if (await canSeeGroup(ctx, group)) return row;
  }
  throw new FeedError(404, `모르는 템플릿입니다: ${templateId}`);
}

async function findEditable(ctx: OpCtx, actor: Actor, templateId: string) {
  const row = await findTemplate(ctx, templateId);
  if (!(await canEditRow(ctx, actor, row)))
    throw new FeedError(403, "만든 사람이나 그룹 관리자만 고칠 수 있습니다");
  return row;
}

export async function listTemplates(
  ctx: OpCtx,
  args: { groupId: string },
): Promise<{ templates: ReportTemplate[] }> {
  const actor = requireActor(ctx);
  const group = await resolveGroup(ctx, args.groupId);
  const rows = await ctx.db
    .selectFrom("report_templates")
    .selectAll()
    .where("group_id", "=", group.id)
    .execute();
  rows.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name, "ko") ||
      a.id.localeCompare(b.id),
  );
  const templates: ReportTemplate[] = [];
  for (const row of rows) templates.push(await toTemplate(ctx, actor, row));
  return { templates };
}

export async function saveTemplate(
  ctx: OpCtx,
  args: SaveReportTemplateRequest,
): Promise<ReportTemplate> {
  const actor = requireActor(ctx);
  const group = await resolveGroup(ctx, args.groupId);
  const params = args.params ?? {};
  await assertInGroup(ctx, group.id, { teamId: params.teamId });
  for (const postTypeId of params.postTypeIds ?? [])
    await assertInGroup(ctx, group.id, { postTypeId });
  await assertActiveUsers(ctx, [params.assigneeId]);
  const values = {
    name: args.name.trim(),
    kind: args.kind,
    params: JSON.stringify(params),
  };
  if (!values.name) throw new FeedError(400, "이름을 적으세요");

  if (args.id) {
    const row = await findEditable(ctx, actor, args.id);
    if (row.group_id !== group.id)
      throw new FeedError(400, "템플릿의 그룹은 바꿀 수 없습니다");
    await ctx.db
      .updateTable("report_templates")
      .set(values)
      .where("id", "=", row.id)
      .execute();
    return toTemplate(ctx, actor, await findTemplate(ctx, row.id));
  }
  if ((await groupRole(ctx, group.id, actor)) === null)
    throw new FeedError(403, "그룹 멤버만 템플릿을 만들 수 있습니다");
  const id = newId("rt");
  await ctx.db
    .insertInto("report_templates")
    .values({ id, owner_id: actor.id, group_id: group.id, ...values })
    .execute();
  return toTemplate(ctx, actor, await findTemplate(ctx, id));
}

export async function deleteTemplate(
  ctx: OpCtx,
  args: { templateId: string },
): Promise<void> {
  const actor = requireActor(ctx);
  const row = await findEditable(ctx, actor, args.templateId);
  await ctx.db
    .deleteFrom("report_templates")
    .where("id", "=", row.id)
    .execute();
}
