// 활동 보고: 기간 안의 변경 이력(events)을 날짜별로, 기간 안에 해결·생성한 게시물, 사람별 수.

import { sql } from "kysely";
import type {
  ActivityReport,
  ActivityReportRequest,
} from "../../services/feed/modules/reports/schemas";
import { resolveGroup } from "../access";
import { type OpCtx, requireActor } from "../context";
import { assertInGroup, toRef } from "../posts/load";
import { iso, localDay } from "../time";
import { reportRange } from "./range";

/**
 * 사람이 아니라 scheduler·다른 게시물의 변화가 남기는 이벤트. 누가 한 일이 아니므로 보고에서 뺀다
 * (화면의 src/feed/views/post/event-text.ts SYSTEM_KINDS와 같은 목록)
 */
const SYSTEM_KINDS = [
  "due_soon",
  "overdue",
  "hold_resumed",
  "unblocked",
  "children_resolved",
];

export async function activityReport(
  ctx: OpCtx,
  args: ActivityReportRequest,
): Promise<ActivityReport> {
  requireActor(ctx);
  const group = await resolveGroup(ctx, args.groupId);
  const [start, end] = reportRange(args.from, args.to);
  await assertInGroup(ctx, group.id, { teamId: args.teamId });
  for (const postTypeId of args.postTypeIds ?? [])
    await assertInGroup(ctx, group.id, { postTypeId });
  const assignee = args.assigneeId;

  // 보고 대상 게시물: 그룹·지우지 않음·팀·게시물 유형
  let posts = ctx.db
    .selectFrom("posts as p")
    .where("p.group_id", "=", group.id)
    .where("p.deleted_at", "is", null);
  if (args.teamId) posts = posts.where("p.team_id", "=", args.teamId);
  if (args.postTypeIds?.length)
    posts = posts.where("p.post_type_id", "in", args.postTypeIds);

  const events = await ctx.db
    .selectFrom("events as e")
    .innerJoin("posts as p", "p.id", "e.post_id")
    .select([
      "e.id",
      "e.post_id",
      "e.actor_id",
      "e.kind",
      "e.field",
      "e.old_value",
      "e.new_value",
      "e.comment_id",
      "e.created_at",
      "p.key",
      "p.title",
      "p.status",
      "p.group_id",
    ])
    .where((eb) => {
      const conds = [
        eb("e.post_id", "in", posts.select("p.id")),
        eb("e.created_at", ">=", start),
        eb("e.created_at", "<", end),
        eb("e.kind", "not in", SYSTEM_KINDS),
      ];
      // 이 사람이 한 일, 또는 이 사람이 담당인 게시물의 일
      if (assignee)
        conds.push(
          eb.or([
            eb("e.actor_id", "=", assignee),
            eb("p.assignee_id", "=", assignee),
          ]),
        );
      return eb.and(conds);
    })
    .orderBy("e.created_at")
    // 한 트랜잭션의 이력은 시각이 같아 넣은 순서(ctid)로 가른다
    .orderBy(sql`e.ctid`)
    .execute();

  const days: ActivityReport["days"] = [];
  const byUser = new Map<string, { events: number; completed: number }>();
  for (const e of events) {
    const date = localDay(e.created_at);
    let bucket = days.at(-1);
    if (bucket?.date !== date) {
      bucket = { date, entries: [] };
      days.push(bucket);
    }
    bucket.entries.push({
      event: {
        id: e.id,
        postId: e.post_id,
        actorId: e.actor_id,
        kind: e.kind,
        field: e.field,
        oldValue: e.old_value,
        newValue: e.new_value,
        commentId: e.comment_id,
        createdAt: iso(e.created_at),
      },
      post: toRef(e),
    });
    const user = byUser.get(e.actor_id) ?? { events: 0, completed: 0 };
    user.events++;
    // 사람별 완료 = 그 사람이 승인한 수. 해결로 가는 길은 승인뿐이고, 승인은 'approved'와
    // 'status → resolved'를 함께 남기므로 'approved'만 세어 두 번 세지 않는다
    if (e.kind === "approved") user.completed++;
    byUser.set(e.actor_id, user);
  }

  const refs = posts.select([
    "p.id",
    "p.key",
    "p.title",
    "p.status",
    "p.group_id",
    "p.assignee_id",
    "p.resolved_at",
    "p.created_at",
  ]);
  const [completed, created] = await Promise.all([
    // 기간 안에 해결되어 지금도 해결 상태인 것 (다시 열면 resolved_at이 지워진다)
    refs
      .where("p.resolved_at", ">=", start)
      .where("p.resolved_at", "<", end)
      .$if(!!assignee, (qb) => qb.where("p.assignee_id", "=", assignee ?? ""))
      .orderBy("p.resolved_at")
      .orderBy("p.seq")
      .execute(),
    refs
      .where("p.created_at", ">=", start)
      .where("p.created_at", "<", end)
      .$if(!!assignee, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("p.author_id", "=", assignee ?? ""),
            eb("p.assignee_id", "=", assignee ?? ""),
          ]),
        ),
      )
      .orderBy("p.created_at")
      .orderBy("p.seq")
      .execute(),
  ]);

  return {
    group: { id: group.id, name: group.name, keyPrefix: group.key_prefix },
    from: args.from,
    to: args.to,
    days,
    completed: completed.map((p) => ({
      post: toRef(p),
      assigneeId: p.assignee_id,
      resolvedAt: iso(p.resolved_at ?? p.created_at),
    })),
    created: created.map(toRef),
    byUser: [...byUser]
      .map(([userId, n]) => ({ userId, ...n }))
      .sort((a, b) => b.events - a.events || a.userId.localeCompare(b.userId)),
  };
}
