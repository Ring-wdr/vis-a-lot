import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PostStatus } from "./db";
import { resetFeed } from "./migrate";
import { createTestFeed, type TestFeed } from "./test-db";

const NOW = new Date("2026-10-23T12:00:00+09:00");

async function seedFixture(t: TestFeed) {
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "가람", email: "u1@ex.com" },
      { id: "u2", name: "나래", email: "u2@ex.com" },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values({ id: "g1", name: "피드", key_prefix: "FD" })
    .execute();
}

let seq = 0;
async function addPost(
  t: TestFeed,
  values: {
    status?: PostStatus;
    due_date?: string;
    hold_until?: string;
    assignee_id?: string;
    deleted?: boolean;
  },
) {
  seq++;
  const id = `p${seq}`;
  await t.db
    .insertInto("posts")
    .values({
      id,
      group_id: "g1",
      seq,
      key: `FD-${seq}`,
      format: "code",
      title: `제목 ${seq}`,
      author_id: "u1",
      status: values.status,
      due_date: values.due_date ?? null,
      hold_until: values.hold_until ?? null,
      assignee_id: values.assignee_id ?? null,
      close_reason: values.status === "on_hold" ? "dependency" : null,
      deleted_at: values.deleted ? NOW : null,
    })
    .execute();
  return id;
}

async function eventsOf(t: TestFeed, kind: string) {
  const rows = await t.db
    .selectFrom("events")
    .select(["post_id", "actor_id"])
    .where("kind", "=", kind)
    .orderBy("post_id")
    .execute();
  return rows;
}

describe("scheduler.run", () => {
  let t: TestFeed;
  beforeAll(async () => {
    t = await createTestFeed();
  }, 60_000);
  beforeEach(async () => {
    seq = 0;
    await resetFeed(t.pglite);
    await seedFixture(t);
  });

  it("D-1·당일은 due_soon, 지난 것은 overdue. 같은 날 두 번 불러도 한 번만", async () => {
    const today = await addPost(t, {
      due_date: "2026-10-23",
      assignee_id: "u2",
    });
    const tomorrow = await addPost(t, {
      status: "in_progress",
      due_date: "2026-10-24",
    });
    const late = await addPost(t, {
      status: "in_review",
      due_date: "2026-10-20",
    });
    await addPost(t, { due_date: "2026-10-25" }); // 아직 멀다
    await addPost(t, { status: "resolved", due_date: "2026-10-20" }); // 닫힘
    await addPost(t, { due_date: "2026-10-20", deleted: true }); // 삭제

    expect(await t.run("scheduler.run", undefined, { now: NOW })).toEqual({
      dueSoon: 2,
      overdue: 1,
      resumed: 0,
    });
    expect((await eventsOf(t, "due_soon")).map((e) => e.post_id)).toEqual([
      today,
      tomorrow,
    ]);
    expect(await eventsOf(t, "overdue")).toEqual([
      { post_id: late, actor_id: "u1" },
    ]);
    // 기한 알림은 담당자(없으면 작성자)에게. 작성자가 행위자여도 받는다
    const notified = await t.db
      .selectFrom("notifications")
      .innerJoin("events", "events.id", "notifications.event_id")
      .select(["events.post_id", "notifications.user_id"])
      .orderBy("events.post_id")
      .execute();
    expect(notified).toEqual([
      { post_id: today, user_id: "u2" },
      { post_id: tomorrow, user_id: "u1" },
      { post_id: late, user_id: "u1" },
    ]);

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(await t.run("scheduler.run", undefined, { now: later })).toEqual({
      dueSoon: 0,
      overdue: 0,
      resumed: 0,
    });
  });

  it("다음 날에는 다시 만든다", async () => {
    await addPost(t, { due_date: "2026-10-20" });
    await t.run("scheduler.run", undefined, { now: NOW });
    const next = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(
      await t.run("scheduler.run", undefined, { now: next }),
    ).toMatchObject({ overdue: 1 });
    expect(await eventsOf(t, "overdue")).toHaveLength(2);
  });

  it("재개일이 된 보류는 미해결로 돌리고 status·hold_resumed를 남긴다", async () => {
    const due = await addPost(t, {
      status: "on_hold",
      hold_until: "2026-10-23",
      assignee_id: "u2",
    });
    const future = await addPost(t, {
      status: "on_hold",
      hold_until: "2026-10-24",
    });

    expect(await t.run("scheduler.run", undefined, { now: NOW })).toEqual({
      dueSoon: 0,
      overdue: 0,
      resumed: 1,
    });
    const posts = await t.db
      .selectFrom("posts")
      .select(["id", "status", "hold_until", "close_reason", "updated_at"])
      .orderBy("id")
      .execute();
    expect(posts[0]).toEqual({
      id: due,
      status: "unresolved",
      hold_until: null,
      close_reason: null,
      updated_at: NOW,
    });
    expect(posts[1]).toMatchObject({ id: future, status: "on_hold" });

    const events = await t.db
      .selectFrom("events")
      .select(["kind", "old_value", "new_value", "actor_id"])
      .where("post_id", "=", due)
      .orderBy("kind")
      .execute();
    expect(events).toEqual([
      {
        kind: "hold_resumed",
        old_value: "2026-10-23",
        new_value: null,
        actor_id: "u1",
      },
      {
        kind: "status",
        old_value: "on_hold",
        new_value: "unresolved",
        actor_id: "u1",
      },
    ]);
    const resumedTo = await t.db
      .selectFrom("notifications")
      .innerJoin("events", "events.id", "notifications.event_id")
      .select("notifications.user_id")
      .where("events.kind", "=", "hold_resumed")
      .orderBy("notifications.user_id")
      .execute();
    expect(resumedTo.map((r) => r.user_id)).toEqual(["u1", "u2"]);

    expect(await t.run("scheduler.run", undefined, { now: NOW })).toMatchObject(
      { resumed: 0 },
    );
  });
});
