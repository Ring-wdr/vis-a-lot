import { beforeEach, describe, expect, it } from "vitest";
import type { FeedArgs } from "./ops";
import { createTestFeed, type TestFeed } from "./test-db";

// 사용자: sys(시스템 관리자), ga(FD 그룹 관리자), a·b·c(FD 멤버), d(DX 멤버), x(비활성)
// 그룹: FD(공개), DX(비공개). 팀·유형은 그룹마다 하나
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
  await t.db
    .insertInto("teams")
    .values([
      { id: "t_fd", group_id: "g_fd", name: "프론트" },
      { id: "t_dx", group_id: "g_dx", name: "데이터" },
    ])
    .execute();
  await t.db
    .insertInto("post_types")
    .values([
      { id: "pt_fd", group_id: "g_fd", name: "버그" },
      { id: "pt_dx", group_id: "g_dx", name: "버그" },
    ])
    .execute();
}

beforeEach(fixture);

const create = (actor: string, args: Partial<FeedArgs<"posts.create">> = {}) =>
  t.run(
    "posts.create",
    { groupId: "g_fd", title: "게시물", ...args },
    { actor },
  );

const events = async (postId: string, actor = "sys") =>
  (await t.run("posts.events", { postId }, { actor })).events;
const kinds = async (postId: string) =>
  (await events(postId)).map((e) => e.kind);
const status = (status: number) => ({ status });

describe("posts.create", () => {
  it("그룹 next_seq로 키를 발급한다", async () => {
    const p1 = await create("a");
    const p2 = await create("b");
    expect([p1.key, p2.key]).toEqual(["FD-1", "FD-2"]);
    const group = await t.db
      .selectFrom("groups")
      .select("next_seq")
      .where("id", "=", "g_fd")
      .executeTakeFirstOrThrow();
    expect(group.next_seq).toBe(3);
    // 키로도 찾는다
    expect(
      (await t.run("posts.get", { postId: "FD-2" }, { actor: "a" })).id,
    ).toBe(p2.id);
  });

  it("기본값·이력·자동 구독·체크리스트 순서", async () => {
    const p = await create("a", {
      assigneeId: "b",
      requesterId: "c",
      stakeholderIds: ["ga"],
      checklist: ["하나", "둘"],
      tags: ["ui"],
      teamId: "t_fd",
      postTypeId: "pt_fd",
      attachments: [{ kind: "link", name: "문서", url: "https://x" }],
    });
    expect(p).toMatchObject({
      status: "unresolved",
      category: "open",
      priority: 2,
      format: "image",
      progress: 0,
      authorId: "a",
      assigneeId: "b",
      requesterId: "c",
      stakeholderIds: ["ga"],
      tags: ["ui"],
      createdAt: "2026-10-23T00:00:00.000Z",
      subscribed: true,
      reopenCount: 0,
    });
    expect(p.checklist.map((i) => i.text)).toEqual(["하나", "둘"]);
    expect(p.attachments).toHaveLength(1);
    const evs = await events(p.id);
    expect(evs.map((e) => [e.kind, e.newValue])).toEqual([
      ["created", null],
      ["assignee", "b"],
    ]);
    const subs = await t.db
      .selectFrom("post_subscribers")
      .select("user_id")
      .where("post_id", "=", p.id)
      .orderBy("user_id")
      .execute();
    expect(subs.map((s) => s.user_id)).toEqual(["a", "b", "c", "ga"]);
  });

  it("비공개 그룹은 멤버만, 공개 그룹은 누구나", async () => {
    await expect(create("a", { groupId: "g_dx" })).rejects.toMatchObject(
      status(404),
    );
    expect((await create("d", { groupId: "DX" })).key).toBe("DX-1");
    // FD 멤버가 아닌 d도 공개 그룹에 올린다
    expect((await create("d")).key).toBe("FD-1");
  });

  it("사용자·팀·유형·상위 검증은 400", async () => {
    await expect(create("a", { assigneeId: "x" })).rejects.toMatchObject(
      status(400),
    );
    await expect(
      create("a", { stakeholderIds: ["nobody"] }),
    ).rejects.toMatchObject(status(400));
    await expect(create("a", { teamId: "t_dx" })).rejects.toMatchObject(
      status(400),
    );
    await expect(create("a", { postTypeId: "pt_dx" })).rejects.toMatchObject(
      status(400),
    );
    const dx = await create("d", { groupId: "g_dx" });
    await expect(create("sys", { parentId: dx.id })).rejects.toMatchObject(
      status(400),
    );
  });
});

describe("가시성·삭제", () => {
  it("비공개 그룹 게시물은 멤버와 시스템 관리자만 본다", async () => {
    const p = await create("d", { groupId: "g_dx" });
    await expect(
      t.run("posts.get", { postId: p.key }, { actor: "a" }),
    ).rejects.toMatchObject(status(404));
    expect(
      (await t.run("posts.get", { postId: p.key }, { actor: "sys" })).id,
    ).toBe(p.id);
    await expect(
      t.run("posts.get", { postId: "FD-999" }, { actor: "a" }),
    ).rejects.toMatchObject(status(404));
  });

  it("작성자·그룹 관리자만 지우고, 지운 것은 404", async () => {
    const p = await create("a", { assigneeId: "b" });
    await expect(
      t.run("posts.delete", { postId: p.id }, { actor: "b" }),
    ).rejects.toMatchObject(status(403));
    await t.run("posts.delete", { postId: p.id }, { actor: "ga" });
    await expect(
      t.run("posts.get", { postId: p.id }, { actor: "a" }),
    ).rejects.toMatchObject(status(404));
    expect((await t.run("posts.query", {}, { actor: "a" })).total).toBe(0);
  });

  it("사용자가 없으면 401", async () => {
    await expect(t.run("posts.query", {})).rejects.toMatchObject(status(401));
  });
});

describe("posts.update", () => {
  it("바뀐 필드마다 이력, 다른 필드는 updated_at만", async () => {
    const p = await create("a", { assigneeId: "b", dueDate: "2026-10-30" });
    const later = new Date("2026-10-24T00:00:00Z");
    const u = await t.run(
      "posts.update",
      {
        postId: p.key,
        title: "새 제목",
        priority: 4,
        assigneeId: "c",
        dueDate: "2026-11-01",
        progress: 40,
        tags: ["a"],
      },
      { actor: "b", now: later },
    );
    expect(u).toMatchObject({
      title: "새 제목",
      priority: 4,
      assigneeId: "c",
      dueDate: "2026-11-01",
      progress: 40,
      updatedAt: later.toISOString(),
    });
    const evs = (await events(p.id)).slice(2);
    expect(evs.map((e) => [e.kind, e.oldValue, e.newValue])).toEqual([
      ["assignee", "b", "c"],
      ["priority", "2", "4"],
      ["due", "2026-10-30", "2026-11-01"],
      ["progress", "0", "40"],
    ]);
    // 같은 값이면 아무것도 남기지 않는다
    await t.run("posts.update", { postId: p.id, priority: 4 }, { actor: "a" });
    expect(await events(p.id)).toHaveLength(6);
  });

  it("고칠 권한: 작성자·담당자·요청자·이해관계자·그룹 관리자", async () => {
    const p = await create("a", { stakeholderIds: ["c"] });
    await expect(
      t.run("posts.update", { postId: p.id, title: "x" }, { actor: "b" }),
    ).rejects.toMatchObject(status(403));
    for (const actor of ["a", "c", "ga", "sys"])
      await t.run("posts.update", { postId: p.id, title: actor }, { actor });
    const detail = await t.run("posts.get", { postId: p.id }, { actor: "b" });
    expect(detail.permissions.edit).toBe(false);
  });

  it("새로 엮인 사람을 구독시키되 끈 구독은 되살리지 않는다", async () => {
    const p = await create("a");
    await t.run("posts.subscribe", { postId: p.id, on: false }, { actor: "c" });
    await t.run(
      "posts.update",
      { postId: p.id, assigneeId: "b", stakeholderIds: ["c"] },
      { actor: "a" },
    );
    expect(
      (await t.run("posts.get", { postId: p.id }, { actor: "b" })).subscribed,
    ).toBe(true);
    expect(
      (await t.run("posts.get", { postId: p.id }, { actor: "c" })).subscribed,
    ).toBe(false);
    const s = await t.run(
      "posts.subscribe",
      { postId: p.id, on: true },
      { actor: "c" },
    );
    expect(s).toEqual({ subscribed: true });
  });

  it("체크리스트가 있으면 진행률을 직접 못 바꾼다", async () => {
    const p = await create("a", { checklist: ["하나"] });
    await expect(
      t.run("posts.update", { postId: p.id, progress: 50 }, { actor: "a" }),
    ).rejects.toMatchObject(status(400));
  });
});

describe("전이", () => {
  const transition = (
    actor: string,
    postId: string,
    to: FeedArgs<"posts.transition">["to"],
    extra: { reason?: string; holdUntil?: string } = {},
  ) =>
    t.run(
      "posts.transition",
      // 잘못된 사유도 넣어 400을 확인한다
      {
        postId,
        to,
        ...(extra as Pick<
          FeedArgs<"posts.transition">,
          "reason" | "holdUntil"
        >),
      },
      { actor },
    );

  it("미해결 → 진행 중: 담당자·그룹 관리자", async () => {
    const p = await create("a", { assigneeId: "b" });
    await expect(transition("a", p.id, "in_progress")).rejects.toMatchObject(
      status(403),
    );
    await expect(transition("b", p.id, "resolved")).rejects.toMatchObject(
      status(409),
    );
    const moved = await transition("b", p.id, "in_progress");
    expect(moved.status).toBe("in_progress");
    const q = await create("a");
    expect((await transition("ga", q.id, "in_progress")).status).toBe(
      "in_progress",
    );
    const evs = await events(p.id);
    expect(evs.at(-1)).toMatchObject({
      kind: "status",
      oldValue: "unresolved",
      newValue: "in_progress",
      actorId: "b",
    });
  });

  it("완료 요청·승인: 요청자, 요청자가 없으면 작성자", async () => {
    const p = await create("a", { assigneeId: "b", requesterId: "c" });
    await transition("b", p.id, "in_progress");
    await expect(
      t.run("posts.requestReview", { postId: p.id }, { actor: "c" }),
    ).rejects.toMatchObject(status(403));
    // transition으로 검토 중에 가면 requestReview와 같다
    const r = await transition("b", p.id, "in_review");
    expect(r.permissions).toMatchObject({ approve: false, reject: false });
    expect((await kinds(p.id)).slice(-2)).toEqual([
      "status",
      "review_requested",
    ]);
    // 작성자는 요청자가 있으면 승인하지 못한다
    await expect(
      t.run("posts.approve", { postId: p.id }, { actor: "a" }),
    ).rejects.toMatchObject(status(403));
    await expect(transition("c", p.id, "in_progress")).rejects.toMatchObject(
      status(409),
    );
    const done = await t.run("posts.approve", { postId: p.id }, { actor: "c" });
    expect(done).toMatchObject({
      status: "resolved",
      category: "closed",
      resolvedAt: "2026-10-23T00:00:00.000Z",
    });
    expect((await kinds(p.id)).slice(-2)).toEqual(["status", "approved"]);

    const q = await create("a", { assigneeId: "b" });
    await transition("b", q.id, "in_progress");
    await t.run("posts.requestReview", { postId: q.id }, { actor: "b" });
    const byAuthor = await t.run("posts.get", { postId: q.id }, { actor: "a" });
    expect(byAuthor.permissions).toMatchObject({
      approve: true,
      reject: true,
      transitions: ["on_hold", "resolved", "cancelled"],
    });
    expect((await transition("a", q.id, "resolved")).status).toBe("resolved");
  });

  it("그룹 관리자·시스템 관리자는 모든 전이", async () => {
    const p = await create("a", { assigneeId: "b", requesterId: "c" });
    await transition("sys", p.id, "in_progress");
    await t.run("posts.requestReview", { postId: p.id }, { actor: "ga" });
    expect(
      (await t.run("posts.approve", { postId: p.id }, { actor: "sys" })).status,
    ).toBe("resolved");
  });

  it("반려는 댓글을 남기고 진행 중으로", async () => {
    const p = await create("a", { assigneeId: "b" });
    await transition("b", p.id, "in_progress");
    await t.run("posts.requestReview", { postId: p.id }, { actor: "b" });
    await expect(
      t.run("posts.reject", { postId: p.id, comment: "  " }, { actor: "a" }),
    ).rejects.toMatchObject(status(400));
    await expect(
      t.run("posts.reject", { postId: p.id, comment: "다시" }, { actor: "b" }),
    ).rejects.toMatchObject(status(403));
    const r = await t.run(
      "posts.reject",
      { postId: p.id, comment: "다시 확인" },
      { actor: "a" },
    );
    expect(r.status).toBe("in_progress");
    expect(r.commentCount).toBe(1);
    const rejected = (await events(p.id)).at(-1);
    expect(rejected?.kind).toBe("rejected");
    const comment = await t.db
      .selectFrom("comments")
      .selectAll()
      .where("id", "=", rejected?.commentId ?? "")
      .executeTakeFirstOrThrow();
    expect(comment).toMatchObject({
      author_id: "a",
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "다시 확인" }] },
        ],
      },
    });
  });

  it("다시 열기: 요청자·작성자·관리자, reopen_count 증가", async () => {
    const p = await create("a", { assigneeId: "b" });
    await expect(
      t.run("posts.reopen", { postId: p.id }, { actor: "a" }),
    ).rejects.toMatchObject(status(409));
    await transition("b", p.id, "cancelled", { reason: "duplicate" });
    await expect(
      t.run("posts.reopen", { postId: p.id }, { actor: "b" }),
    ).rejects.toMatchObject(status(403));
    const r = await t.run("posts.reopen", { postId: p.id }, { actor: "a" });
    expect(r).toMatchObject({
      status: "unresolved",
      reopenCount: 1,
      closeReason: null,
      resolvedAt: null,
    });
    expect((await kinds(p.id)).slice(-2)).toEqual(["status", "reopened"]);
    await transition("a", p.id, "cancelled", { reason: "low_priority" });
    expect((await transition("ga", p.id, "unresolved")).reopenCount).toBe(2);
  });

  it("보류는 사유+재개일, 취소는 사유가 필요하다", async () => {
    const p = await create("a", { assigneeId: "b" });
    await expect(
      transition("b", p.id, "on_hold", {
        reason: "duplicate",
        holdUntil: "2026-11-01",
      }),
    ).rejects.toMatchObject(status(400));
    await expect(
      transition("b", p.id, "on_hold", { reason: "decision" }),
    ).rejects.toMatchObject(status(400));
    await expect(transition("c", p.id, "on_hold")).rejects.toMatchObject(
      status(403),
    );
    const held = await transition("b", p.id, "on_hold", {
      reason: "decision",
      holdUntil: "2026-11-01",
    });
    expect(held).toMatchObject({
      status: "on_hold",
      category: "paused",
      closeReason: "decision",
      holdUntil: "2026-11-01",
    });
    // 보류에서 바로 취소는 안 된다 (열림에서만)
    await expect(
      transition("b", p.id, "cancelled", { reason: "duplicate" }),
    ).rejects.toMatchObject(status(409));
    const resumed = await transition("a", p.id, "unresolved");
    expect(resumed).toMatchObject({ closeReason: null, holdUntil: null });
    await expect(transition("a", p.id, "cancelled")).rejects.toMatchObject(
      status(400),
    );
    expect(
      (await transition("a", p.id, "cancelled", { reason: "out_of_scope" }))
        .closeReason,
    ).toBe("out_of_scope");
  });
});

describe("하위·차단·진행률", () => {
  async function resolve(postId: string) {
    await t.run(
      "posts.transition",
      { postId, to: "in_progress" },
      { actor: "ga" },
    );
    await t.run("posts.requestReview", { postId }, { actor: "ga" });
    return t.run("posts.approve", { postId }, { actor: "ga" });
  }

  it("하위가 모두 끝나면 상위가 검토 중으로, 진행률도 따라간다", async () => {
    const parent = await create("a", { requesterId: "c" });
    const c1 = await create("a", { parentId: parent.key });
    const c2 = await create("a", { parentId: parent.id });
    const c3 = await create("a");
    await t.run(
      "posts.setParent",
      { postId: c3.id, parentId: parent.id },
      { actor: "a" },
    );
    await resolve(c1.id);
    let p = await t.run("posts.get", { postId: parent.id }, { actor: "a" });
    expect(p).toMatchObject({
      progress: 33,
      childCount: 3,
      childResolvedCount: 1,
      status: "unresolved",
    });
    expect(p.children.map((c) => c.key)).toEqual([c1.key, c2.key, c3.key]);
    await t.run(
      "posts.transition",
      { postId: c2.id, to: "cancelled", reason: "duplicate" },
      { actor: "a" },
    );
    await resolve(c3.id);
    p = await t.run("posts.get", { postId: parent.id }, { actor: "a" });
    expect(p).toMatchObject({ progress: 100, status: "in_review" });
    const evs = await events(parent.id);
    expect(evs.slice(-2).map((e) => [e.kind, e.newValue])).toEqual([
      ["status", "in_review"],
      ["children_resolved", null],
    ]);
    expect(
      evs.filter((e) => e.kind === "progress").map((e) => e.newValue),
    ).toEqual(["33", "67", "100"]);
    // 진행률을 직접 못 바꾼다
    await expect(
      t.run(
        "posts.update",
        { postId: parent.id, progress: 10 },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(400));
    // 하위를 떼면 진행률이 다시 계산된다
    await t.run(
      "posts.setParent",
      { postId: c3.id, parentId: null },
      { actor: "a" },
    );
    p = await t.run("posts.get", { postId: parent.id }, { actor: "a" });
    expect(p.progress).toBe(100);
    expect((await events(c3.id)).filter((e) => e.kind === "relation")).toEqual([
      expect.objectContaining({ field: "parent", newValue: parent.key }),
      expect.objectContaining({
        field: "parent",
        oldValue: parent.key,
        newValue: null,
      }),
    ]);
  });

  it("setParent: 자기 자신·순환·다른 그룹은 400", async () => {
    const a = await create("a");
    const b = await create("a", { parentId: a.id });
    const c = await create("a", { parentId: b.id });
    const dx = await create("d", { groupId: "g_dx" });
    const set = (postId: string, parentId: string) =>
      t.run("posts.setParent", { postId, parentId }, { actor: "sys" });
    await expect(set(a.id, a.id)).rejects.toMatchObject(status(400));
    await expect(set(a.id, c.id)).rejects.toMatchObject(status(400));
    await expect(set(dx.id, a.id)).rejects.toMatchObject(status(400));
  });

  it("막던 게시물이 닫히면 다른 열린 차단이 없는 쪽에 unblocked", async () => {
    const blocker1 = await create("a");
    const blocker2 = await create("a");
    const target = await create("a");
    for (const from of [blocker1, blocker2])
      await t.run(
        "posts.addRelation",
        { postId: from.id, toId: target.key, kind: "blocks" },
        { actor: "a" },
      );
    let s = await t.run("posts.get", { postId: target.id }, { actor: "a" });
    expect(s.blocked).toBe(true);
    expect(s.relations).toEqual([
      expect.objectContaining({ kind: "blocks", direction: "incoming" }),
      expect.objectContaining({ kind: "blocks", direction: "incoming" }),
    ]);
    await t.run(
      "posts.transition",
      { postId: blocker1.id, to: "cancelled", reason: "duplicate" },
      { actor: "a" },
    );
    expect(await kinds(target.id)).not.toContain("unblocked");
    await resolve(blocker2.id);
    const evs = await events(target.id);
    expect(evs.at(-1)).toMatchObject({
      kind: "unblocked",
      actorId: "ga",
      newValue: blocker2.key,
    });
    s = await t.run("posts.get", { postId: target.id }, { actor: "a" });
    expect(s.blocked).toBe(false);
  });

  it("관계: 자기 자신은 400, 중복은 무시, 지우기", async () => {
    const a = await create("a");
    const b = await create("a");
    const add = () =>
      t.run(
        "posts.addRelation",
        { postId: a.id, toId: b.id, kind: "relates" },
        { actor: "a" },
      );
    await expect(
      t.run(
        "posts.addRelation",
        { postId: a.id, toId: a.key, kind: "relates" },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(400));
    await add();
    const detail = await add();
    expect(detail.relations).toEqual([
      {
        kind: "relates",
        direction: "outgoing",
        post: {
          id: b.id,
          key: b.key,
          title: b.title,
          status: "unresolved",
          groupId: "g_fd",
        },
      },
    ]);
    const removed = await t.run(
      "posts.removeRelation",
      { postId: a.id, toId: b.id, kind: "relates" },
      { actor: "a" },
    );
    expect(removed.relations).toEqual([]);
    const rel = (await events(a.id)).filter((e) => e.kind === "relation");
    expect(rel.map((e) => [e.field, e.oldValue, e.newValue])).toEqual([
      ["relates", null, b.key],
      ["relates", b.key, null],
    ]);
  });

  it("체크리스트: 추가·체크·지우기·순서, 진행률과 이력", async () => {
    const p = await create("a", { checklist: ["하나", "둘"] });
    let d = await t.run(
      "posts.checklistAdd",
      { postId: p.id, text: "셋" },
      { actor: "a" },
    );
    const [one, two, three] = d.checklist;
    expect(three).toMatchObject({ text: "셋", sort: 2, done: false });
    d = await t.run(
      "posts.checklistUpdate",
      { postId: p.id, itemId: one.id, done: true },
      { actor: "a" },
    );
    expect(d.progress).toBe(33);
    d = await t.run(
      "posts.checklistRemove",
      { postId: p.id, itemId: two.id },
      { actor: "a" },
    );
    expect(d.progress).toBe(50);
    d = await t.run(
      "posts.checklistReorder",
      { postId: p.id, ids: [three.id, one.id] },
      { actor: "a" },
    );
    expect(d.checklist.map((i) => i.text)).toEqual(["셋", "하나"]);
    await expect(
      t.run(
        "posts.checklistUpdate",
        { postId: p.id, itemId: "nope", done: true },
        { actor: "a" },
      ),
    ).rejects.toMatchObject(status(404));
    await expect(
      t.run("posts.checklistAdd", { postId: p.id, text: "남" }, { actor: "b" }),
    ).rejects.toMatchObject(status(403));
    const evs = (await events(p.id)).filter((e) =>
      ["checklist", "progress"].includes(e.kind),
    );
    expect(evs.map((e) => [e.kind, e.field, e.newValue])).toEqual([
      ["checklist", "셋", "added"],
      ["checklist", "하나", "done"],
      ["progress", null, "33"],
      ["checklist", "둘", "removed"],
      ["progress", null, "50"],
    ]);
  });
});

describe("posts.query", () => {
  const query = (actor: string, args: FeedArgs<"posts.query"> = {}) =>
    t.run("posts.query", args, { actor });
  const keys = async (actor: string, args: FeedArgs<"posts.query"> = {}) =>
    (await query(actor, args)).posts.map((p) => p.key);

  it("내 작업 탭과 기한·검색·태그 필터", async () => {
    const p1 = await create("a", {
      assigneeId: "b",
      dueDate: "2026-10-20",
      title: "로그인 오류",
      tags: ["auth"],
    });
    const p2 = await create("b", {
      requesterId: "a",
      stakeholderIds: ["c"],
      dueDate: "2026-10-25",
      body: { type: "doc", content: [{ type: "text", text: "차트 50% 깨짐" }] },
    });
    const p3 = await create("c", { assigneeId: "b", priority: 4 });
    await create("d", { groupId: "g_dx", assigneeId: "d" });
    // p3를 검토 중으로 (요청자 없음 → 작성자 c가 승인할 사람)
    await t.run(
      "posts.transition",
      { postId: p3.id, to: "in_progress" },
      { actor: "b" },
    );
    await t.run("posts.requestReview", { postId: p3.id }, { actor: "b" });

    expect(await keys("b", { filter: { mine: "assigned" } })).toEqual([
      p3.key,
      p1.key,
    ]);
    expect(await keys("a", { filter: { mine: "requested" } })).toEqual([
      p2.key,
    ]);
    expect(await keys("c", { filter: { mine: "stakeholder" } })).toEqual([
      p2.key,
    ]);
    expect(await keys("c", { filter: { mine: "review" } })).toEqual([p3.key]);
    expect(await keys("ga", { filter: { mine: "review" } })).toEqual([p3.key]);
    expect(await keys("a", { filter: { mine: "review" } })).toEqual([]);
    expect(await keys("a", { filter: { overdue: true } })).toEqual([p1.key]);
    expect(await keys("a", { filter: { q: "오류" } })).toEqual([p1.key]);
    expect(await keys("a", { filter: { q: "50%" } })).toEqual([p2.key]);
    expect(await keys("a", { filter: { tags: ["auth", "zzz"] } })).toEqual([
      p1.key,
    ]);
    expect(
      await keys("a", {
        filter: { dueFrom: "2026-10-21", dueTo: "2026-10-31" },
      }),
    ).toEqual([p2.key]);
    expect(
      await keys("a", { filter: { priorities: [4], statuses: ["in_review"] } }),
    ).toEqual([p3.key]);
    expect(
      await keys("a", {
        filter: { categories: ["open"], authorIds: ["a", "b"] },
      }),
    ).toEqual([p2.key, p1.key]);
    expect(
      await keys("a", { filter: { assigneeIds: [], teamIds: [] } }),
    ).toHaveLength(3);
  });

  it("비공개 그룹은 멤버·시스템 관리자에게만 보인다", async () => {
    await create("a");
    await create("d", { groupId: "g_dx" });
    expect(await keys("a")).toEqual(["FD-1"]);
    expect(await keys("d")).toEqual(["DX-1", "FD-1"].sort().reverse());
    expect((await query("sys")).total).toBe(2);
    expect(await keys("a", { filter: { groupIds: ["g_dx"] } })).toEqual([]);
  });

  it("관심한 사람 글, 상위 필터", async () => {
    const p1 = await create("a");
    await create("b");
    const child = await create("c", { parentId: p1.key });
    await t.db
      .insertInto("user_follows")
      .values({ follower_id: "ga", followee_id: "a" })
      .execute();
    expect(await keys("ga", { filter: { followedAuthors: true } })).toEqual([
      p1.key,
    ]);
    expect(await keys("ga", { filter: { parentId: p1.key } })).toEqual([
      child.key,
    ]);
  });

  it("정렬·끌어올리기·페이지·total", async () => {
    const p1 = await create("a", { dueDate: "2026-11-05", title: "다" });
    const p2 = await create("a", { title: "가" });
    const p3 = await create("a", { dueDate: "2026-11-01", title: "나" });
    expect(await keys("a", { sort: { field: "dueDate", dir: "asc" } })).toEqual(
      [p3.key, p1.key, p2.key],
    );
    expect(
      await keys("a", { sort: { field: "dueDate", dir: "desc" } }),
    ).toEqual([p1.key, p3.key, p2.key]);
    expect(await keys("a", { sort: { field: "title", dir: "asc" } })).toEqual([
      p2.key,
      p3.key,
      p1.key,
    ]);
    // 기본: updatedAt desc, 같으면 번호 큰 것부터
    expect(await keys("a")).toEqual([p3.key, p2.key, p1.key]);
    await t.run("posts.pin", { postId: p1.id, on: true }, { actor: "b" });
    await t.run(
      "posts.pin",
      { postId: p2.id, on: true },
      { actor: "b", now: new Date("2026-10-24T00:00:00Z") },
    );
    expect(await keys("a", { pinnedFirst: true })).toEqual([
      p2.key,
      p1.key,
      p3.key,
    ]);
    const page = await query("a", { limit: 1, offset: 1 });
    expect(page.total).toBe(3);
    expect(page.posts.map((p) => p.key)).toEqual([p2.key]);
    const unpinned = await t.run(
      "posts.pin",
      { postId: p1.id, on: false },
      { actor: "b" },
    );
    expect(unpinned.pinnedAt).toBeNull();
  });

  it("요약의 개수 필드", async () => {
    const p = await create("a", { stakeholderIds: ["c", "b"] });
    await create("a", { parentId: p.id });
    await t.db
      .insertInto("comments")
      .values([
        { id: "c1", post_id: p.id, author_id: "a", created_at: new Date() },
        {
          id: "c2",
          post_id: p.id,
          author_id: "a",
          created_at: new Date(),
          deleted_at: new Date(),
        },
      ])
      .execute();
    const [summary] = (
      await query("a", {
        filter: { parentId: undefined, authorIds: ["a"] },
        sort: { field: "key", dir: "asc" },
      })
    ).posts;
    expect(summary).toMatchObject({
      key: p.key,
      stakeholderIds: ["b", "c"],
      commentCount: 1,
      childCount: 1,
      childResolvedCount: 0,
      blocked: false,
    });
  });
});

describe("posts.mySummary·bulkUpdate·events", () => {
  it("내 작업 요약", async () => {
    await create("a", { assigneeId: "b", dueDate: "2026-10-20" });
    await create("a", { assigneeId: "b", dueDate: "2026-10-26" });
    await create("a", { assigneeId: "b", dueDate: "2026-10-27" });
    const r = await create("b", { assigneeId: "b" });
    await t.run(
      "posts.transition",
      { postId: r.id, to: "in_progress" },
      { actor: "b" },
    );
    await t.run("posts.requestReview", { postId: r.id }, { actor: "b" });
    expect(await t.run("posts.mySummary", undefined, { actor: "b" })).toEqual({
      assigned: 4,
      awaitingReview: 1,
      dueSoon: 2,
    });
  });

  it("일괄 변경은 게시물마다 규칙을 따르고 실패는 따로 모은다", async () => {
    const mine = await create("a", { assigneeId: "b" });
    const other = await create("c", { assigneeId: "c" });
    const dx = await create("d", { groupId: "g_dx" });
    const res = await t.run(
      "posts.bulkUpdate",
      {
        ids: [mine.key, other.key, dx.key, "FD-404"],
        patch: { priority: 3, status: "in_progress" },
      },
      { actor: "b" },
    );
    expect(res.updated).toEqual([mine.key]);
    expect(res.failed.map((f) => f.id)).toEqual([other.key, dx.key, "FD-404"]);
    const got = await t.run("posts.get", { postId: mine.id }, { actor: "b" });
    expect(got).toMatchObject({ priority: 3, status: "in_progress" });

    // 필드는 바꿀 수 있어도 전이가 실패하면 그 게시물의 쓰기는 되돌린다
    const blocked = await create("b", { assigneeId: "c" });
    const res2 = await t.run(
      "posts.bulkUpdate",
      { ids: [blocked.id], patch: { priority: 0, status: "in_progress" } },
      { actor: "b" },
    );
    expect(res2.failed).toEqual([
      { id: blocked.id, error: expect.any(String) },
    ]);
    const after = await t.run(
      "posts.get",
      { postId: blocked.id },
      { actor: "b" },
    );
    expect(after.priority).toBe(2);
    expect(await kinds(blocked.id)).toEqual(["created", "assignee"]);
  });

  it("이력은 오래된 순", async () => {
    const p = await create("a", { assigneeId: "b" });
    await t.run(
      "posts.update",
      { postId: p.id, priority: 3 },
      { actor: "a", now: new Date("2026-10-25T00:00:00Z") },
    );
    await t.run(
      "posts.update",
      { postId: p.id, priority: 1 },
      { actor: "a", now: new Date("2026-10-24T00:00:00Z") },
    );
    expect((await events(p.id)).map((e) => e.newValue)).toEqual([
      null,
      "b",
      "1",
      "3",
    ]);
  });

  it("상세 권한", async () => {
    const p = await create("a", { assigneeId: "b", requesterId: "c" });
    const perms = async (actor: string) =>
      (await t.run("posts.get", { postId: p.id }, { actor })).permissions;
    expect(await perms("b")).toEqual({
      edit: true,
      transitions: ["in_progress", "on_hold", "cancelled"],
      requestReview: false,
      approve: false,
      reject: false,
      reopen: false,
      delete: false,
    });
    expect(await perms("a")).toMatchObject({
      transitions: ["on_hold", "cancelled"],
      delete: true,
    });
    expect(await perms("ga")).toMatchObject({
      edit: true,
      transitions: ["in_progress", "on_hold", "cancelled"],
      delete: true,
    });
    expect(await perms("d")).toEqual({
      edit: false,
      transitions: [],
      requestReview: false,
      approve: false,
      reject: false,
      reopen: false,
      delete: false,
    });
  });
});
