import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type EventInput, recordEvent } from "./events";
import { resetFeed } from "./migrate";
import { createTestFeed, type TestFeed } from "./test-db";

/** u1·u2 사용자, 공개 g1에 p1·p2, 비공개 g2에 p3. 모두 u2가 구독 */
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
    .values([
      { id: "g1", name: "피드", key_prefix: "FD" },
      { id: "g2", name: "비밀", key_prefix: "SC", is_private: true },
    ])
    .execute();
  await t.db
    .insertInto("group_members")
    .values({ group_id: "g2", user_id: "u2", role: "member" })
    .execute();
  const post = (id: string, group_id: string, key: string, seq: number) => ({
    id,
    group_id,
    seq,
    key,
    format: "image" as const,
    title: `제목 ${key}`,
    author_id: "u1",
  });
  await t.db
    .insertInto("posts")
    .values([
      post("p1", "g1", "FD-1", 1),
      post("p2", "g1", "FD-2", 2),
      post("p3", "g2", "SC-1", 1),
    ])
    .execute();
  await t.db
    .insertInto("post_subscribers")
    .values(["p1", "p2", "p3"].map((post_id) => ({ post_id, user_id: "u2" })))
    .execute();
}

async function emit(t: TestFeed, input: EventInput, now: Date) {
  return t.db
    .transaction()
    .execute((trx) =>
      recordEvent(
        { db: trx, actor: { id: "u1", name: "가람", isAdmin: false }, now },
        input,
      ),
    );
}

const at = (minute: number) =>
  new Date(`2026-10-23T10:${String(minute).padStart(2, "0")}:00+09:00`);

describe("notifications", () => {
  let t: TestFeed;
  beforeAll(async () => {
    t = await createTestFeed();
  }, 60_000);
  beforeEach(async () => {
    await resetFeed(t.pglite);
    await seedFixture(t);
    await emit(t, { postId: "p1", kind: "comment" }, at(1));
    await emit(t, { postId: "p2", kind: "comment" }, at(2));
    await emit(
      t,
      {
        postId: "p1",
        kind: "status",
        oldValue: "unresolved",
        newValue: "in_progress",
      },
      at(3),
    );
    await emit(t, { postId: "p3", kind: "comment" }, at(4));
  });

  it("알림함은 게시물별로 묶고 최근 순으로 정렬한다", async () => {
    const inbox = await t.run("notifications.inbox", {}, { actor: "u2" });
    expect(inbox.unreadTotal).toBe(4);
    expect(inbox.groups.map((g) => g.post.key)).toEqual([
      "SC-1",
      "FD-1",
      "FD-2",
    ]);
    const fd1 = inbox.groups[1];
    expect(fd1.unread).toBe(2);
    expect(fd1.notifications.map((n) => n.kind)).toEqual(["status", "comment"]);
    expect(fd1.notifications[0].event).toMatchObject({
      postId: "p1",
      actorId: "u1",
      kind: "status",
      newValue: "in_progress",
    });
    expect(fd1.post).toEqual({
      id: "p1",
      key: "FD-1",
      title: "제목 FD-1",
      status: "unresolved",
      groupId: "g1",
    });
  });

  it("볼 수 없게 된 게시물과 삭제된 게시물은 뺀다", async () => {
    await t.db.deleteFrom("group_members").execute();
    await t.db
      .updateTable("posts")
      .set({ deleted_at: at(5) })
      .where("id", "=", "p2")
      .execute();
    const inbox = await t.run("notifications.inbox", {}, { actor: "u2" });
    expect(inbox.groups.map((g) => g.post.key)).toEqual(["FD-1"]);
    expect(inbox.unreadTotal).toBe(2);
    expect(
      await t.run("notifications.unreadCount", undefined, { actor: "u2" }),
    ).toEqual({ count: 2 });
  });

  it("읽음·안읽음·보관은 내 알림만 바꾸고 안읽음 수를 돌려준다", async () => {
    const inbox = await t.run("notifications.inbox", {}, { actor: "u2" });
    const ids = inbox.groups[1].notifications.map((n) => n.id);
    // 남의 알림은 바뀌지 않는다
    expect(
      await t.run("notifications.markRead", { ids }, { actor: "u1" }),
    ).toEqual({ count: 0 });
    expect(
      await t.run("notifications.markRead", { ids }, { actor: "u2" }),
    ).toEqual({ count: 2 });
    const unreadOnly = await t.run(
      "notifications.inbox",
      { unreadOnly: true },
      { actor: "u2" },
    );
    expect(unreadOnly.groups.map((g) => g.post.key)).toEqual(["SC-1", "FD-2"]);

    expect(
      await t.run(
        "notifications.markUnread",
        { ids: [ids[0]] },
        { actor: "u2" },
      ),
    ).toEqual({ count: 3 });

    const p2 = inbox.groups[2].notifications[0].id;
    expect(
      await t.run("notifications.archive", { ids: [p2] }, { actor: "u2" }),
    ).toEqual({ count: 2 });
    const archived = await t.run(
      "notifications.inbox",
      { archived: true },
      { actor: "u2" },
    );
    expect(archived.groups.map((g) => g.post.key)).toEqual(["FD-2"]);
    expect(archived.groups[0].notifications[0].readAt).not.toBeNull();
    expect(archived.groups[0].notifications[0].archivedAt).not.toBeNull();
    const active = await t.run("notifications.inbox", {}, { actor: "u2" });
    expect(active.groups.map((g) => g.post.key)).toEqual(["SC-1", "FD-1"]);
  });

  it("사용자가 없으면 401", async () => {
    await expect(t.run("notifications.inbox", {})).rejects.toMatchObject({
      status: 401,
    });
  });

  it("설정은 기본값을 채워 전체를 돌려주고, 보낸 것만 덮어쓴다", async () => {
    const { settings } = await t.run("notifications.getSettings", undefined, {
      actor: "u2",
    });
    expect(settings).toHaveLength(12);
    expect(settings[0]).toEqual({
      kind: "assigned",
      inapp: true,
      slack: true,
      email: false,
    });
    expect(settings.find((s) => s.kind === "overdue")).toEqual({
      kind: "overdue",
      inapp: true,
      slack: true,
      email: true,
    });
    expect(settings.find((s) => s.kind === "comment")?.slack).toBe(false);

    const comment = {
      kind: "comment" as const,
      inapp: false,
      slack: true,
      email: true,
    };
    await t.run(
      "notifications.setSettings",
      { settings: [comment] },
      { actor: "u2" },
    );
    const saved = await t.run(
      "notifications.setSettings",
      { settings: [{ ...comment, email: false }] },
      { actor: "u2" },
    );
    expect(saved.settings.find((s) => s.kind === "comment")).toEqual({
      ...comment,
      email: false,
    });
    expect(saved.settings[0]).toEqual(settings[0]);

    // 새 설정이 dispatch에 반영된다
    await t.db.deleteFrom("outbox").execute();
    await emit(t, { postId: "p1", kind: "comment" }, at(9));
    const outbox = await t.run("outbox.list", undefined);
    expect(outbox.messages.map((m) => [m.channel, m.recipient])).toEqual([
      ["slack", "u2@ex.com"],
    ]);
    const inbox = await t.run("notifications.inbox", {}, { actor: "u2" });
    expect(inbox.unreadTotal).toBe(4);
  });

  it("발송 로그는 최근 순", async () => {
    await emit(t, { postId: "p1", kind: "assignee", newValue: "u2" }, at(10));
    await emit(t, { postId: "p2", kind: "assignee", newValue: "u2" }, at(11));
    const { messages } = await t.run("outbox.list", undefined);
    expect(messages).toHaveLength(2);
    expect(messages[0].body).toContain("FD-2");
    expect(messages[0].createdAt).toBe(at(11).toISOString());
  });
});
