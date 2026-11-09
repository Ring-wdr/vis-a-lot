import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { EventInput } from "./events";
import { recordEvent } from "./events";
import { resetFeed } from "./migrate";
import { createTestFeed, type TestFeed } from "./test-db";

const NOW = new Date("2026-10-23T12:00:00+09:00");

/** u1 작성자, u2 담당자, u3 요청자, u4 구독자, u5 비활성 */
async function seedFixture(t: TestFeed) {
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "가람", email: "u1@ex.com" },
      { id: "u2", name: "나래", email: "u2@ex.com" },
      { id: "u3", name: "다솜", email: null },
      { id: "u4", name: "라온", email: "u4@ex.com" },
      { id: "u5", name: "마루", email: "u5@ex.com", active: false },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values({ id: "g1", name: "피드", key_prefix: "FD" })
    .execute();
  await t.db
    .insertInto("posts")
    .values({
      id: "p1",
      group_id: "g1",
      seq: 1,
      key: "FD-1",
      format: "chart",
      title: "차트 깨짐",
      author_id: "u1",
      assignee_id: "u2",
      requester_id: "u3",
    })
    .execute();
  await t.db
    .insertInto("post_subscribers")
    .values(
      ["u1", "u2", "u3", "u4", "u5"].map((user_id) => ({
        post_id: "p1",
        user_id,
      })),
    )
    .execute();
}

async function emit(
  t: TestFeed,
  actorId: string,
  input: EventInput,
  now = NOW,
) {
  return t.db
    .transaction()
    .execute((trx) =>
      recordEvent(
        { db: trx, actor: { id: actorId, name: actorId, isAdmin: false }, now },
        input,
      ),
    );
}

async function recipients(t: TestFeed, eventId: string) {
  const rows = await t.db
    .selectFrom("notifications")
    .select("user_id")
    .where("event_id", "=", eventId)
    .execute();
  return rows.map((r) => r.user_id).sort();
}

describe("dispatchEvent", () => {
  let t: TestFeed;
  beforeAll(async () => {
    t = await createTestFeed();
  }, 60_000);
  beforeEach(async () => {
    await resetFeed(t.pglite);
    await seedFixture(t);
  });

  it("담당 지정은 새 담당자에게만", async () => {
    const e = await emit(t, "u1", {
      postId: "p1",
      kind: "assignee",
      oldValue: null,
      newValue: "u4",
    });
    expect(await recipients(t, e.id)).toEqual(["u4"]);
  });

  it("멘션은 extraRecipients에게만, 행위자는 뺀다", async () => {
    const e = await emit(t, "u1", {
      postId: "p1",
      kind: "mention",
      extraRecipients: ["u1", "u4"],
    });
    expect(await recipients(t, e.id)).toEqual(["u4"]);
  });

  it("댓글은 구독자에게 (행위자·비활성·음소거 제외, 중복 없음)", async () => {
    await t.db
      .updateTable("post_subscribers")
      .set({ muted: true })
      .where("user_id", "=", "u3")
      .execute();
    await t.db.insertInto("users").values({ id: "u6", name: "바다" }).execute();
    const e = await emit(t, "u2", {
      postId: "p1",
      kind: "comment",
      extraRecipients: ["u4", "u6"],
    });
    expect(await recipients(t, e.id)).toEqual(["u1", "u4", "u6"]);
  });

  it("완료 요청은 요청자에게, 요청자가 없으면 작성자에게", async () => {
    const e = await emit(t, "u2", { postId: "p1", kind: "review_requested" });
    expect(await recipients(t, e.id)).toEqual(["u3"]);
    await t.db
      .updateTable("posts")
      .set({ requester_id: null })
      .where("id", "=", "p1")
      .execute();
    const e2 = await emit(t, "u2", { postId: "p1", kind: "review_requested" });
    expect(await recipients(t, e2.id)).toEqual(["u1"]);
  });

  it("승인은 담당자와 구독자에게", async () => {
    await t.db
      .updateTable("post_subscribers")
      .set({ muted: true })
      .where("user_id", "in", ["u1", "u4"])
      .execute();
    const e = await emit(t, "u3", { postId: "p1", kind: "approved" });
    expect(await recipients(t, e.id)).toEqual(["u2"]);
  });

  it("기한 알림은 행위자(작성자)여도 담당자가 없으면 작성자에게 간다", async () => {
    await t.db
      .updateTable("posts")
      .set({ assignee_id: null })
      .where("id", "=", "p1")
      .execute();
    const e = await emit(t, "u1", { postId: "p1", kind: "overdue" });
    expect(await recipients(t, e.id)).toEqual(["u1"]);
  });

  it("보류 재개는 담당자와 작성자에게", async () => {
    const e = await emit(t, "u1", { postId: "p1", kind: "hold_resumed" });
    expect(await recipients(t, e.id)).toEqual(["u1", "u2"]);
  });

  it("알리지 않는 이벤트는 아무것도 만들지 않는다", async () => {
    const e = await emit(t, "u1", { postId: "p1", kind: "priority" });
    expect(await recipients(t, e.id)).toEqual([]);
    expect(await t.db.selectFrom("outbox").selectAll().execute()).toEqual([]);
  });

  it("기본 설정: 배정은 슬랙, 초과는 슬랙+이메일", async () => {
    await emit(t, "u1", { postId: "p1", kind: "assignee", newValue: "u4" });
    let outbox = await t.db.selectFrom("outbox").selectAll().execute();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      channel: "slack",
      recipient: "u4@ex.com",
      subject: null,
    });
    expect(outbox[0].body).toContain("FD-1");
    expect(outbox[0].body).toContain("차트 깨짐");
    expect(outbox[0].body).toContain("가람");
    expect(outbox[0].body).toContain("/feed/post?key=FD-1");

    await t.db.deleteFrom("outbox").execute();
    await emit(t, "u1", { postId: "p1", kind: "overdue" });
    outbox = await t.db
      .selectFrom("outbox")
      .selectAll()
      .orderBy("channel")
      .execute();
    expect(outbox.map((o) => o.channel)).toEqual(["email", "slack"]);
    expect(outbox[0].subject).toContain("FD-1");
  });

  it("댓글·상태는 기본으로 앱 내만", async () => {
    await emit(t, "u2", { postId: "p1", kind: "comment" });
    await emit(t, "u2", {
      postId: "p1",
      kind: "status",
      oldValue: "unresolved",
      newValue: "in_progress",
    });
    expect(await t.db.selectFrom("outbox").selectAll().execute()).toEqual([]);
  });

  it("저장한 설정을 따른다: 앱 내 끔, 이메일 켬, 이메일 없으면 이름으로", async () => {
    await t.db
      .insertInto("notification_settings")
      .values([
        {
          user_id: "u3",
          event_kind: "review_requested",
          inapp: false,
          slack: false,
          email: true,
        },
      ])
      .execute();
    const e = await emit(t, "u2", { postId: "p1", kind: "review_requested" });
    expect(await recipients(t, e.id)).toEqual([]);
    const outbox = await t.db.selectFrom("outbox").selectAll().execute();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ channel: "email", recipient: "다솜" });
  });

  it("비공개 그룹에서 멤버가 아닌 사람에게는 보내지 않는다", async () => {
    await t.db
      .updateTable("groups")
      .set({ is_private: true })
      .where("id", "=", "g1")
      .execute();
    await t.db
      .insertInto("group_members")
      .values({ group_id: "g1", user_id: "u1", role: "member" })
      .execute();
    const e = await emit(t, "u2", { postId: "p1", kind: "comment" });
    expect(await recipients(t, e.id)).toEqual(["u1"]);
  });
});
