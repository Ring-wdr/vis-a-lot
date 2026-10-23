import { beforeEach, describe, expect, it } from "vitest";
import type { FeedArgs } from "./ops";
import { createTestFeed, type TestFeed } from "./test-db";

// 사용자: sys(시스템 관리자), ga(FD 그룹 관리자), a·b·c(FD 멤버), d(DX 멤버), x(비활성)
// 그룹: FD(공개), DX(비공개). FD-1은 a가 쓰고 b가 담당, DX-1은 d가 쓴 게시물
let t: TestFeed;

async function fixture() {
  t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "sys", name: "시스템", is_admin: true },
      { id: "ga", name: "관리자" },
      { id: "a", name: "가" },
      { id: "b", name: "나" },
      { id: "c", name: "다" },
      { id: "d", name: "라" },
      { id: "x", name: "비활성", active: false },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values([
      { id: "g_fd", name: "피드", key_prefix: "FD" },
      { id: "g_dx", name: "DX", key_prefix: "DX", is_private: true },
    ])
    .execute();
  await t.db
    .insertInto("group_members")
    .values([
      { group_id: "g_fd", user_id: "ga", role: "admin" },
      { group_id: "g_fd", user_id: "a", role: "member" },
      { group_id: "g_fd", user_id: "b", role: "member" },
      { group_id: "g_fd", user_id: "c", role: "member" },
      { group_id: "g_dx", user_id: "d", role: "member" },
    ])
    .execute();
  await t.run(
    "posts.create",
    { groupId: "FD", title: "공개 글", assigneeId: "b" },
    { actor: "a" },
  );
  await t.run(
    "posts.create",
    { groupId: "DX", title: "비공개 글" },
    { actor: "d" },
  );
}

beforeEach(fixture);

const text = (s: string) => ({ type: "text", text: s });
const mention = (id: string) => ({ type: "mention", attrs: { id, label: id } });
const doc = (...inline: object[]) => ({
  type: "doc",
  content: [{ type: "paragraph", content: inline }],
});

// 댓글마다 1분씩 늦게 써서 순서가 정해지게 한다
let tick = 0;
const comment = (
  actor: string,
  args: Partial<FeedArgs<"comments.create">> = {},
  now = new Date(Date.parse("2026-10-23T09:00:00+09:00") + ++tick * 60_000),
) =>
  t.run(
    "comments.create",
    { postId: "FD-1", body: doc(text("댓글")), ...args },
    { actor, now },
  );

const threads = async (actor = "a", postId = "FD-1") =>
  (await t.run("comments.list", { postId }, { actor })).threads;

const status = (status: number) => ({ status });

async function notificationsOf(userId: string, kind?: string) {
  let q = t.db
    .selectFrom("notifications as n")
    .innerJoin("events as e", "e.id", "n.event_id")
    .select(["e.kind", "e.comment_id", "e.new_value"])
    .where("n.user_id", "=", userId);
  if (kind) q = q.where("e.kind", "=", kind);
  return q.execute();
}

async function subscription(userId: string, postKey = "FD-1") {
  return t.db
    .selectFrom("post_subscribers as s")
    .innerJoin("posts as p", "p.id", "s.post_id")
    .select("s.muted")
    .where("p.key", "=", postKey)
    .where("s.user_id", "=", userId)
    .executeTakeFirst();
}

describe("comments.create", () => {
  it("스레드를 만들고 대댓글의 대댓글은 스레드 첫 댓글에 붙인다", async () => {
    const t1 = new Date("2026-10-23T09:00:00+09:00");
    const root = await comment("a", {}, t1);
    expect(root).toMatchObject({
      parentId: null,
      authorId: "a",
      createdAt: t1.toISOString(),
      updatedAt: null,
      deleted: false,
    });
    const reply = await comment("b", { parentId: root.id });
    const nested = await comment("c", { parentId: reply.id });
    expect(reply.parentId).toBe(root.id);
    expect(nested.parentId).toBe(root.id);

    const list = await threads();
    expect(list).toHaveLength(1);
    expect(list[0].replies.map((r) => r.id)).toEqual([reply.id, nested.id]);
  });

  it("빈 본문, 다른 게시물의 부모는 400", async () => {
    await expect(comment("a", { body: doc() })).rejects.toMatchObject(
      status(400),
    );
    await expect(comment("a", { body: "글자" })).rejects.toMatchObject(
      status(400),
    );
    const other = await t.run(
      "posts.create",
      { groupId: "FD", title: "다른 글" },
      { actor: "a" },
    );
    const elsewhere = await comment("a", { postId: other.key });
    await expect(
      comment("a", { parentId: elsewhere.id }),
    ).rejects.toMatchObject(status(400));
  });

  it("비공개 그룹 게시물은 멤버가 아니면 404", async () => {
    await expect(comment("a", { postId: "DX-1" })).rejects.toMatchObject(
      status(404),
    );
    await expect(threads("a", "DX-1")).rejects.toMatchObject(status(404));
    const own = await comment("d", { postId: "DX-1" });
    await expect(
      t.run(
        "comments.react",
        { commentId: own.id, emoji: "👍", on: true },
        {
          actor: "a",
        },
      ),
    ).rejects.toMatchObject(status(404));
    expect(await threads("sys", "DX-1")).toHaveLength(1);
  });

  it("comment 이력을 남기고 구독자에게 알린다. 쓴 사람은 구독된다", async () => {
    const c = await comment("c");
    const events = (
      await t.run("posts.events", { postId: "FD-1" }, { actor: "a" })
    ).events;
    expect(events.at(-1)).toMatchObject({ kind: "comment", commentId: c.id });
    // 작성자 a·담당자 b는 구독자
    expect(await notificationsOf("a", "comment")).toHaveLength(1);
    expect(await notificationsOf("b", "comment")).toHaveLength(1);
    expect(await notificationsOf("c", "comment")).toHaveLength(0);
    expect(await subscription("c")).toEqual({ muted: false });
  });

  it("멘션: 볼 수 있는 활성 사용자마다 mention 이력과 알림, 구독", async () => {
    const c = await comment("a", {
      body: doc(
        mention("c"),
        text(" 확인 "),
        mention("d"),
        mention("x"),
        mention("a"),
        mention("c"),
      ),
    });
    expect(c.mentions).toEqual(["c", "d", "x", "a"]);
    const mentions = await t.db
      .selectFrom("events")
      .select(["new_value", "comment_id"])
      .where("kind", "=", "mention")
      .execute();
    // d는 공개 그룹이라 볼 수 있다. 비활성 x와 자기 자신 a는 빠진다
    expect(mentions.map((m) => m.new_value).sort()).toEqual(["c", "d"]);
    expect(mentions.every((m) => m.comment_id === c.id)).toBe(true);
    expect(await notificationsOf("c", "mention")).toEqual([
      { kind: "mention", comment_id: c.id, new_value: "c" },
    ]);
    expect(await notificationsOf("d", "mention")).toHaveLength(1);
    // 멘션된 사람은 같은 댓글로 comment 알림을 받지 않는다 (구독은 그 뒤에 된다)
    expect(await notificationsOf("c", "comment")).toHaveLength(0);
    expect(await subscription("c")).toEqual({ muted: false });
    expect(await subscription("d")).toEqual({ muted: false });
  });

  it("비공개 그룹에서는 멤버가 아닌 사람을 멘션해도 알리지 않는다", async () => {
    await comment("d", {
      postId: "DX-1",
      body: doc(mention("a"), mention("sys")),
    });
    const mentions = await t.db
      .selectFrom("events")
      .select("new_value")
      .where("kind", "=", "mention")
      .execute();
    expect(mentions.map((m) => m.new_value)).toEqual(["sys"]);
    expect(await subscription("a", "DX-1")).toBeUndefined();
  });

  it("구독 중인 사람이 멘션되면 멘션 알림 하나만 받는다", async () => {
    // b는 FD-1의 담당자라 이미 구독 중
    await comment("a", { body: doc(mention("b")) });
    expect(await notificationsOf("b", "mention")).toHaveLength(1);
    expect(await notificationsOf("b", "comment")).toHaveLength(0);
    // 멘션되지 않은 다른 구독자(작성자가 아닌 ga 등)는 그대로 댓글 알림을 받는다
    await comment("b");
    expect(await notificationsOf("a", "comment")).toHaveLength(1);
  });

  it("끈 구독은 다시 켜지 않는다", async () => {
    await t.run(
      "posts.subscribe",
      { postId: "FD-1", on: false },
      { actor: "c" },
    );
    await comment("c");
    await comment("a", { body: doc(mention("c")) });
    expect(await subscription("c")).toEqual({ muted: true });
    // 멘션 알림은 끈 구독과 상관없이 간다
    expect(await notificationsOf("c", "mention")).toHaveLength(1);
  });
});

describe("comments.update", () => {
  it("쓴 사람만, 새로 멘션된 사람에게만 알린다", async () => {
    const c = await comment("a", { body: doc(mention("b")) });
    const later = new Date("2026-10-23T10:00:00+09:00");
    const updated = await t.run(
      "comments.update",
      { commentId: c.id, body: doc(mention("b"), mention("c")) },
      { actor: "a", now: later },
    );
    expect(updated.updatedAt).toBe(later.toISOString());
    expect(updated.mentions).toEqual(["b", "c"]);
    expect(await notificationsOf("b", "mention")).toHaveLength(1);
    expect(await notificationsOf("c", "mention")).toHaveLength(1);

    await expect(
      t.run(
        "comments.update",
        { commentId: c.id, body: doc(text("남의 글")) },
        { actor: "ga" },
      ),
    ).rejects.toMatchObject(status(403));
    await expect(
      t.run(
        "comments.update",
        { commentId: c.id, body: doc() },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(400));
  });
});

describe("comments.delete", () => {
  it("쓴 사람·그룹 관리자만 지우고, 지운 댓글은 본문을 숨긴다", async () => {
    const root = await comment("a");
    const reply = await comment("b", { parentId: root.id });
    const lonely = await comment("c");
    await expect(
      t.run("comments.delete", { commentId: root.id }, { actor: "c" }),
    ).rejects.toMatchObject(status(403));
    await t.run("comments.delete", { commentId: root.id }, { actor: "a" });
    await t.run("comments.delete", { commentId: lonely.id }, { actor: "ga" });

    const list = await threads();
    // 대댓글이 남은 첫 댓글만 자리를 남긴다
    expect(list.map((th) => th.id)).toEqual([root.id]);
    expect(list[0]).toMatchObject({
      deleted: true,
      body: null,
      mentions: [],
      permissions: { edit: false, delete: false },
    });
    expect(list[0].replies.map((r) => r.id)).toEqual([reply.id]);

    await t.run("comments.delete", { commentId: reply.id }, { actor: "b" });
    expect(await threads()).toEqual([]);
    const post = await t.run("posts.get", { postId: "FD-1" }, { actor: "a" });
    expect(post.commentCount).toBe(0);
    await expect(
      t.run(
        "comments.react",
        { commentId: reply.id, emoji: "👍", on: true },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(400));
  });
});

describe("comments.resolve·pin", () => {
  it("스레드 첫 댓글에만, 해결은 게시물을 고칠 수 있는 사람과 첫 댓글 쓴 사람", async () => {
    const root = await comment("c");
    const reply = await comment("a", { parentId: root.id });
    await expect(
      t.run(
        "comments.resolve",
        { commentId: reply.id, on: true },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(400));
    // c는 게시물을 고칠 수 없지만 첫 댓글을 썼다
    const resolved = await t.run(
      "comments.resolve",
      { commentId: root.id, on: true },
      { actor: "c" },
    );
    expect(resolved.resolved).toBe(true);
    const other = await comment("a");
    await expect(
      t.run(
        "comments.resolve",
        { commentId: other.id, on: true },
        { actor: "c" },
      ),
    ).rejects.toMatchObject(status(403));
    // 담당자 b는 게시물을 고칠 수 있다
    await t.run(
      "comments.resolve",
      { commentId: other.id, on: true },
      { actor: "b" },
    );
    expect((await threads("c")).map((th) => th.permissions.resolve)).toEqual([
      true,
      false,
    ]);
  });

  it("고정은 게시물을 고칠 수 있는 사람만, 고정한 스레드가 먼저", async () => {
    const first = await comment("a", {}, new Date("2026-10-23T09:00:00+09:00"));
    const second = await comment(
      "c",
      {},
      new Date("2026-10-23T09:05:00+09:00"),
    );
    await expect(
      t.run("comments.pin", { commentId: second.id, on: true }, { actor: "c" }),
    ).rejects.toMatchObject(status(403));
    const reply = await comment("a", { parentId: first.id });
    await expect(
      t.run("comments.pin", { commentId: reply.id, on: true }, { actor: "a" }),
    ).rejects.toMatchObject(status(400));
    await t.run(
      "comments.pin",
      { commentId: second.id, on: true },
      { actor: "a" },
    );
    const list = await threads();
    expect(list.map((th) => [th.id, th.pinned])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);
    expect(list[0].permissions.pin).toBe(true);
    expect((await threads("c"))[0].permissions.pin).toBe(false);
  });
});

describe("comments.react", () => {
  it("켜고 끄며, 이모지별로 세고 내 반응을 표시한다", async () => {
    const c = await comment("a");
    const react = (actor: string, emoji: string, on: boolean) =>
      t.run("comments.react", { commentId: c.id, emoji, on }, { actor });
    await react("a", "👍", true);
    await react("a", "👍", true);
    await react("b", "👍", true);
    const after = await react("b", "🎉", true);
    expect(after.reactions).toEqual([
      { emoji: "👍", count: 2, mine: true },
      { emoji: "🎉", count: 1, mine: true },
    ]);
    const off = await react("a", "👍", false);
    expect(off.reactions).toEqual([
      { emoji: "👍", count: 1, mine: false },
      { emoji: "🎉", count: 1, mine: false },
    ]);
  });
});

describe("polls.vote", () => {
  const poll = {
    question: "언제 할까요",
    options: ["오늘", "내일", "모레"],
    closesAt: "2026-10-24T09:00:00+09:00",
  };

  it("투표하고 다시 고르면 바뀐다. 범위 밖·마감 뒤는 400", async () => {
    const c = await comment("a", { body: doc(), poll });
    expect(c.body).toBeNull();
    expect(c.poll).toMatchObject({
      question: "언제 할까요",
      votes: [0, 0, 0],
      myVote: null,
      closed: false,
    });
    const pollId = c.poll?.id ?? "";
    const vote = (actor: string, optionIdx: number, now?: Date) =>
      t.run("polls.vote", { pollId, optionIdx }, { actor, now });
    await vote("b", 0);
    await vote("c", 1);
    const changed = await vote("b", 2);
    expect(changed.poll).toMatchObject({ votes: [0, 1, 1], myVote: 2 });
    await expect(vote("a", 3)).rejects.toMatchObject(status(400));
    await expect(
      vote("a", 0, new Date("2026-10-24T09:00:00+09:00")),
    ).rejects.toMatchObject(status(400));
    const list = await t.run(
      "comments.list",
      { postId: "FD-1" },
      { actor: "c", now: new Date("2026-10-25T00:00:00+09:00") },
    );
    expect(list.threads[0].poll).toMatchObject({ closed: true, myVote: 1 });
  });

  it("시드의 투표가 보인다", async () => {
    t = await createTestFeed();
    await t.run("seed.load", { scenario: "default" });
    const vote = await t.db
      .selectFrom("polls")
      .innerJoin("comments", "comments.id", "polls.comment_id")
      .innerJoin("posts", "posts.id", "comments.post_id")
      .select(["posts.key", "polls.id"])
      .executeTakeFirstOrThrow();
    const list = await threads("u1", vote.key);
    const withPoll = list.find((th) => th.poll);
    expect(withPoll?.poll).toMatchObject({ id: vote.id, myVote: 0 });
    expect(withPoll?.poll?.votes.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe("attachments", () => {
  it("게시물을 고칠 수 있는 사람만 더하고 지운다", async () => {
    const later = new Date("2026-10-23T11:00:00+09:00");
    const added = await t.run(
      "attachments.add",
      {
        postId: "FD-1",
        kind: "link",
        name: "문서",
        url: "https://example.com",
      },
      { actor: "b", now: later },
    );
    expect(added).toMatchObject({ kind: "link", name: "문서" });
    let post = await t.run("posts.get", { postId: "FD-1" }, { actor: "a" });
    expect(post.attachments).toEqual([added]);
    expect(post.updatedAt).toBe(later.toISOString());

    await expect(
      t.run(
        "attachments.add",
        { postId: "FD-1", kind: "link", name: "x", url: "https://x" },
        { actor: "c" },
      ),
    ).rejects.toMatchObject(status(403));
    await expect(
      t.run(
        "attachments.remove",
        { postId: "FD-1", attachmentId: added.id },
        { actor: "c" },
      ),
    ).rejects.toMatchObject(status(403));
    await expect(
      t.run(
        "attachments.add",
        { postId: "DX-1", kind: "link", name: "x", url: "https://x" },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(404));

    await t.run(
      "attachments.remove",
      { postId: "FD-1", attachmentId: added.id },
      { actor: "ga" },
    );
    post = await t.run("posts.get", { postId: "FD-1" }, { actor: "a" });
    expect(post.attachments).toEqual([]);
    await expect(
      t.run(
        "attachments.remove",
        { postId: "FD-1", attachmentId: added.id },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(404));
  });
});

describe("게시물 설명의 멘션", () => {
  it("만들 때와 설명을 고칠 때 새로 멘션된 사람에게만 알린다", async () => {
    const p = await t.run(
      "posts.create",
      {
        groupId: "FD",
        title: "멘션 글",
        body: doc(mention("c"), mention("a")),
      },
      { actor: "a" },
    );
    const mentionEvents = async () =>
      t.db
        .selectFrom("events")
        .select(["new_value", "comment_id"])
        .where("post_id", "=", p.id)
        .where("kind", "=", "mention")
        .execute();
    expect(await mentionEvents()).toEqual([
      { new_value: "c", comment_id: null },
    ]);
    expect(await notificationsOf("c", "mention")).toHaveLength(1);
    expect(await subscription("c", p.key)).toEqual({ muted: false });

    await t.run(
      "posts.update",
      { postId: p.id, body: doc(mention("c"), mention("b")) },
      { actor: "a" },
    );
    // 제목만 바꾸면 멘션을 다시 보지 않는다
    await t.run(
      "posts.update",
      { postId: p.id, title: "새 제목" },
      { actor: "a" },
    );
    expect((await mentionEvents()).map((e) => e.new_value)).toEqual(["c", "b"]);
    expect(await notificationsOf("c", "mention")).toHaveLength(1);
    expect(await notificationsOf("b", "mention")).toHaveLength(1);
  });
});
