// 현황 보고: 지금 상태별 수, 기한 초과, 담당자별 부하, 검토 대기 체류, 최근 30일 리드타임, 열린·멈춘 게시물.

import type { StatusReport } from "../../services/feed/modules/reports/schemas";
import { resolveGroup } from "../access";
import { type OpCtx, requireActor } from "../context";
import type { PostStatus } from "../db";
import { assertInGroup } from "../posts/load";
import { loadSummaries } from "../posts/mapper";
import { categoryOf, STATUS_ORDER } from "../posts/workflow";
import { day, localDay } from "../time";
import { average, median, round1 } from "./range";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Load = StatusReport["assigneeLoad"][number];

export async function statusReport(
  ctx: OpCtx,
  args: { groupId: string; teamId?: string },
): Promise<StatusReport> {
  requireActor(ctx);
  const group = await resolveGroup(ctx, args.groupId);
  await assertInGroup(ctx, group.id, { teamId: args.teamId });
  const today = localDay(ctx.now);
  const now = ctx.now.getTime();

  let query = ctx.db
    .selectFrom("posts")
    .select([
      "id",
      "seq",
      "status",
      "assignee_id",
      "due_date",
      "created_at",
      "updated_at",
      "resolved_at",
    ])
    .where("group_id", "=", group.id)
    .where("deleted_at", "is", null);
  if (args.teamId) query = query.where("team_id", "=", args.teamId);
  const rows = (await query.execute()).map((r) => ({
    ...r,
    due: day(r.due_date),
    category: categoryOf(r.status),
  }));
  const isOverdue = (r: (typeof rows)[number]) =>
    r.category === "open" && r.due !== null && r.due < today;

  const byStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, 0]),
  ) as Record<PostStatus, number>;
  const load = new Map<string | null, Load>();
  for (const r of rows) {
    byStatus[r.status]++;
    if (r.category !== "open") continue;
    const entry = load.get(r.assignee_id) ?? {
      userId: r.assignee_id,
      open: 0,
      inReview: 0,
      overdue: 0,
    };
    entry.open++;
    if (r.status === "in_review") entry.inReview++;
    if (isOverdue(r)) entry.overdue++;
    load.set(r.assignee_id, entry);
  }

  // 검토 대기: 마지막 완료 요청부터 지금까지. 요청 이력이 없으면(하위가 다 끝나 자동으로 들어온 것 등) 마지막 수정 시각
  const inReview = rows.filter((r) => r.status === "in_review");
  const requested = inReview.length
    ? await ctx.db
        .selectFrom("events")
        .select((eb) => ["post_id", eb.fn.max("created_at").as("at")])
        .where("kind", "=", "review_requested")
        .where(
          "post_id",
          "in",
          inReview.map((r) => r.id),
        )
        .groupBy("post_id")
        .execute()
    : [];
  const requestedAt = new Map(
    requested.map((e) => [e.post_id, new Date(e.at).getTime()]),
  );
  const waits = inReview.map(
    (r) =>
      Math.max(0, now - (requestedAt.get(r.id) ?? r.updated_at.getTime())) /
      HOUR,
  );

  // 리드타임: 최근 30일 안에 해결된(지금도 해결 상태인) 게시물의 만든 시각 → 해결 시각
  const leads = rows.flatMap((r) => {
    if (r.status !== "resolved" || !r.resolved_at) return [];
    const resolved = r.resolved_at.getTime();
    if (resolved < now - 30 * DAY || resolved > now) return [];
    return [(resolved - r.created_at.getTime()) / DAY];
  });

  // 하단 목록: 기한 지난 것 먼저, 그다음 기한순(없으면 뒤), 같으면 번호순
  const listed = rows
    .filter((r) => r.category !== "closed")
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        a.seq - b.seq,
    );

  return {
    group: { id: group.id, name: group.name, keyPrefix: group.key_prefix },
    byStatus,
    overdue: rows.filter(isOverdue).length,
    assigneeLoad: [...load.values()].sort(
      (a, b) =>
        b.open - a.open ||
        Number(a.userId === null) - Number(b.userId === null) ||
        (a.userId ?? "").localeCompare(b.userId ?? ""),
    ),
    reviewWait: {
      count: waits.length,
      avgHours: round1(average(waits)),
      maxHours: round1(waits.length ? Math.max(...waits) : 0),
    },
    leadTime30d: {
      count: leads.length,
      avgDays: round1(average(leads)),
      medianDays: round1(median(leads)),
    },
    posts: await loadSummaries(
      ctx,
      listed.map((r) => r.id),
    ),
  };
}
