// 피드 notifications 모듈: 알림함(게시물별 묶음), 읽음·보관, 알림 설정(이벤트 × 채널), 발송 로그.

import type {
  InboxResponse,
  NotificationSetting,
  NotifyKind,
  OutboxMessage,
} from "../services/feed/modules/notifications/schemas";
import { visibleGroupIds } from "./access";
import { defineOps, type OpCtx, requireActor } from "./context";
import { defaultSetting, NOTIFY_KINDS, notifyKindOf } from "./dispatch";
import { iso } from "./time";

/** 지금 사용자의 알림 중 볼 수 있는 게시물(삭제·비공개 제외)에 걸린 것 */
async function myNotifications(ctx: OpCtx) {
  const actor = requireActor(ctx);
  const groupIds = await visibleGroupIds(ctx);
  if (groupIds.length === 0) return null;
  return ctx.db
    .selectFrom("notifications as n")
    .innerJoin("events as e", "e.id", "n.event_id")
    .innerJoin("posts as p", "p.id", "e.post_id")
    .where("n.user_id", "=", actor.id)
    .where("p.deleted_at", "is", null)
    .where("p.group_id", "in", groupIds);
}

async function unreadTotal(ctx: OpCtx) {
  const query = await myNotifications(ctx);
  if (!query) return 0;
  const row = await query
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("n.read_at", "is", null)
    .where("n.archived_at", "is", null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

async function settingsOf(ctx: OpCtx, userId: string) {
  const rows = await ctx.db
    .selectFrom("notification_settings")
    .select(["event_kind", "inapp", "slack", "email"])
    .where("user_id", "=", userId)
    .execute();
  const stored = new Map(rows.map((r) => [r.event_kind, r]));
  return NOTIFY_KINDS.map((kind): NotificationSetting => {
    const row = stored.get(kind);
    return row
      ? { kind, inapp: row.inapp, slack: row.slack, email: row.email }
      : defaultSetting(kind);
  });
}

/** 내 알림만 바꾸고 바꾼 뒤 안읽음 수를 돌려준다 */
async function updateMine(
  ctx: OpCtx,
  ids: string[],
  change: "read" | "unread" | "archive",
) {
  const actor = requireActor(ctx);
  const base = () =>
    ctx.db
      .updateTable("notifications")
      .where("user_id", "=", actor.id)
      .where("id", "in", ids);
  if (change === "read")
    await base()
      .set({ read_at: ctx.now })
      .where("read_at", "is", null)
      .execute();
  else if (change === "unread") await base().set({ read_at: null }).execute();
  else {
    await base()
      .set({ read_at: ctx.now })
      .where("read_at", "is", null)
      .execute();
    await base().set({ archived_at: ctx.now }).execute();
  }
  return { count: await unreadTotal(ctx) };
}

export const notificationsOps = defineOps({
  "notifications.inbox": async (
    ctx,
    args: { unreadOnly?: boolean; archived?: boolean } | undefined,
  ): Promise<InboxResponse> => {
    const query = await myNotifications(ctx);
    if (!query) return { groups: [], unreadTotal: 0 };
    let rows = query
      .select([
        "n.id",
        "n.read_at",
        "n.archived_at",
        "n.created_at",
        "e.id as event_id",
        "e.post_id",
        "e.actor_id",
        "e.kind",
        "e.field",
        "e.old_value",
        "e.new_value",
        "e.comment_id",
        "e.created_at as event_created_at",
        "p.key",
        "p.title",
        "p.status",
        "p.group_id",
      ])
      .where("n.archived_at", args?.archived ? "is not" : "is", null);
    if (args?.unreadOnly) rows = rows.where("n.read_at", "is", null);
    const list = await rows
      .orderBy("n.created_at", "desc")
      .orderBy("n.id", "desc")
      .execute();

    // 최근 알림 순으로 정렬했으므로 처음 나온 게시물 순서가 곧 묶음 순서다
    const groups = new Map<string, InboxResponse["groups"][number]>();
    for (const r of list) {
      const kind = notifyKindOf(r.kind);
      if (!kind) continue;
      let group = groups.get(r.post_id);
      if (!group) {
        group = {
          post: {
            id: r.post_id,
            key: r.key,
            title: r.title,
            status: r.status,
            groupId: r.group_id,
          },
          notifications: [],
          unread: 0,
        };
        groups.set(r.post_id, group);
      }
      group.notifications.push({
        id: r.id,
        kind,
        event: {
          id: r.event_id,
          postId: r.post_id,
          actorId: r.actor_id,
          kind: r.kind,
          field: r.field,
          oldValue: r.old_value,
          newValue: r.new_value,
          commentId: r.comment_id,
          createdAt: iso(r.event_created_at),
        },
        readAt: iso(r.read_at),
        archivedAt: iso(r.archived_at),
        createdAt: iso(r.created_at),
      });
      if (!r.read_at) group.unread++;
    }
    return {
      groups: [...groups.values()],
      unreadTotal: await unreadTotal(ctx),
    };
  },

  "notifications.unreadCount": async (ctx): Promise<{ count: number }> => ({
    count: await unreadTotal(ctx),
  }),

  "notifications.markRead": async (ctx, args: { ids: string[] }) =>
    updateMine(ctx, args.ids, "read"),

  "notifications.markUnread": async (ctx, args: { ids: string[] }) =>
    updateMine(ctx, args.ids, "unread"),

  "notifications.archive": async (ctx, args: { ids: string[] }) =>
    updateMine(ctx, args.ids, "archive"),

  "notifications.getSettings": async (
    ctx,
  ): Promise<{ settings: NotificationSetting[] }> => ({
    settings: await settingsOf(ctx, requireActor(ctx).id),
  }),

  "notifications.setSettings": async (
    ctx,
    args: { settings: NotificationSetting[] },
  ): Promise<{ settings: NotificationSetting[] }> => {
    const actor = requireActor(ctx);
    for (const s of args.settings) {
      const values = { inapp: s.inapp, slack: s.slack, email: s.email };
      await ctx.db
        .insertInto("notification_settings")
        .values({
          user_id: actor.id,
          event_kind: s.kind satisfies NotifyKind,
          ...values,
        })
        .onConflict((oc) =>
          oc.columns(["user_id", "event_kind"]).doUpdateSet(values),
        )
        .execute();
    }
    return { settings: await settingsOf(ctx, actor.id) };
  },

  "outbox.list": async (ctx): Promise<{ messages: OutboxMessage[] }> => {
    const rows = await ctx.db
      .selectFrom("outbox")
      .selectAll()
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(200)
      .execute();
    return {
      messages: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        recipient: r.recipient,
        subject: r.subject,
        body: r.body,
        createdAt: iso(r.created_at),
      })),
    };
  },
});
