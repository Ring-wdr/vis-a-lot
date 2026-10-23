// 피드 scheduler 모듈: 기한 알림(D-1·당일·초과, 게시물마다 하루 1회)과 보류 자동 복귀.
// 화면이 앱 시작 시와 1분 간격으로 부른다. 같은 날 여러 번 불러도 새로 만드는 것이 없다.

import type { SchedulerRunResponse } from "../services/feed/modules/scheduler/schemas";
import { defineOps, type OpCtx } from "./context";
import { type EventKind, recordEvent } from "./events";
import { day, localDay } from "./time";

/** ctx.now가 속한 로컬 날짜의 [자정, 다음 자정) */
function localDayRange(now: Date): [Date, Date] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start, end];
}

/** 오늘 이미 같은 종류의 이벤트를 만든 게시물 id */
async function postsWithEventToday(ctx: OpCtx, kind: EventKind) {
  const [start, end] = localDayRange(ctx.now);
  const rows = await ctx.db
    .selectFrom("events")
    .select("post_id")
    .where("kind", "=", kind)
    .where("created_at", ">=", start)
    .where("created_at", "<", end)
    .execute();
  return new Set(rows.map((r) => r.post_id));
}

export const schedulerOps = defineOps({
  "scheduler.run": async (ctx): Promise<SchedulerRunResponse> => {
    const today = localDay(ctx.now);
    const tomorrow = localDay(ctx.now, 1);
    const result = { dueSoon: 0, overdue: 0, resumed: 0 };

    const open = await ctx.db
      .selectFrom("posts")
      .select(["id", "author_id", "due_date"])
      .where("status", "in", ["unresolved", "in_progress", "in_review"])
      .where("deleted_at", "is", null)
      .where("due_date", "is not", null)
      .orderBy("key")
      .execute();
    const dueSoonDone = await postsWithEventToday(ctx, "due_soon");
    const overdueDone = await postsWithEventToday(ctx, "overdue");
    for (const post of open) {
      const due = day(post.due_date);
      if (!due) continue;
      const kind: EventKind | null =
        due === today || due === tomorrow
          ? "due_soon"
          : due < today
            ? "overdue"
            : null;
      if (!kind) continue;
      if ((kind === "due_soon" ? dueSoonDone : overdueDone).has(post.id))
        continue;
      await recordEvent(ctx, {
        postId: post.id,
        kind,
        field: "due_date",
        newValue: due,
        actorId: post.author_id,
      });
      if (kind === "due_soon") result.dueSoon++;
      else result.overdue++;
    }

    const held = await ctx.db
      .selectFrom("posts")
      .select(["id", "author_id", "hold_until"])
      .where("status", "=", "on_hold")
      .where("deleted_at", "is", null)
      .where("hold_until", "is not", null)
      .orderBy("key")
      .execute();
    for (const post of held) {
      const until = day(post.hold_until);
      if (!until || until > today) continue;
      await ctx.db
        .updateTable("posts")
        .set({
          status: "unresolved",
          hold_until: null,
          close_reason: null,
          updated_at: ctx.now,
        })
        .where("id", "=", post.id)
        .execute();
      await recordEvent(ctx, {
        postId: post.id,
        kind: "status",
        field: "status",
        oldValue: "on_hold",
        newValue: "unresolved",
        actorId: post.author_id,
      });
      await recordEvent(ctx, {
        postId: post.id,
        kind: "hold_resumed",
        oldValue: until,
        actorId: post.author_id,
      });
      result.resumed++;
    }
    return result;
  },
});
