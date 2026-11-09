import { describe, expect, it } from "vitest";
import type { PostStatus } from "./db";
import { createTestFeed, type TestFeed } from "./test-db";
import { localDay } from "./time";

// 시각은 모두 로컬 시각으로 만든다 (보고 날짜 경계가 로컬 자정이라 테스트가 시간대에 매이지 않게)
const at = (month: number, date: number, hour = 0, minute = 0) =>
  new Date(2026, month - 1, date, hour, minute);
/** 2026-10-23(금) 09:00 */
const NOW = at(10, 23, 9);

type PostSpec = {
  n: number;
  status: PostStatus;
  team?: string | null;
  type?: string | null;
  assignee?: string | null;
  author?: string;
  due?: string | null;
  created: Date;
  updated?: Date;
  resolved?: Date | null;
  deleted?: boolean;
  group?: "g1" | "g2";
};

// a 멤버, b FD 관리자·DX 멤버, c 아무 그룹에도 없음. DX는 비공개
async function setup() {
  const t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "a", name: "가" },
      { id: "b", name: "나" },
      { id: "c", name: "다" },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values([
      { id: "g1", name: "피드", key_prefix: "FD" },
      { id: "g2", name: "데이터", key_prefix: "DX", is_private: true },
    ])
    .execute();
  await t.db
    .insertInto("group_members")
    .values([
      { group_id: "g1", user_id: "a", role: "member" },
      { group_id: "g1", user_id: "b", role: "admin" },
      { group_id: "g2", user_id: "b", role: "member" },
    ])
    .execute();
  await t.db
    .insertInto("teams")
    .values([
      { id: "t1", group_id: "g1", name: "가팀" },
      { id: "t2", group_id: "g1", name: "나팀" },
      { id: "t9", group_id: "g2", name: "DX팀" },
    ])
    .execute();
  await t.db
    .insertInto("post_types")
    .values([
      { id: "pt1", group_id: "g1", name: "업무 기록" },
      { id: "pt2", group_id: "g1", name: "버그" },
    ])
    .execute();

  const posts: PostSpec[] = [
    // 최근 30일 해결: 리드타임 20·9·1일
    {
      n: 1,
      status: "resolved",
      team: "t1",
      type: "pt1",
      assignee: "a",
      created: at(10, 1, 10),
      resolved: at(10, 21, 10),
    },
    {
      n: 2,
      status: "resolved",
      team: "t2",
      type: "pt2",
      assignee: "a",
      created: at(10, 13, 10),
      resolved: at(10, 22, 10),
    },
    {
      n: 3,
      status: "resolved",
      team: "t1",
      type: "pt1",
      assignee: "b",
      author: "b",
      created: at(10, 20, 9),
      resolved: at(10, 21, 9),
    },
    // 30일보다 전에 해결
    { n: 4, status: "resolved", created: at(8, 1), resolved: at(9, 1) },
    // 검토 중: 완료 요청 12시간 전 / 요청 이력 없이 수정 6시간 전
    {
      n: 5,
      status: "in_review",
      team: "t1",
      type: "pt1",
      assignee: "a",
      due: "2026-10-20",
      created: at(10, 10),
      updated: at(10, 22, 21),
    },
    {
      n: 6,
      status: "in_review",
      team: "t2",
      created: at(10, 15),
      updated: at(10, 23, 3),
    },
    {
      n: 7,
      status: "unresolved",
      team: "t1",
      assignee: "a",
      due: "2026-10-23",
      created: at(10, 18, 23, 59),
    },
    {
      n: 8,
      status: "in_progress",
      team: "t2",
      type: "pt2",
      assignee: "b",
      due: "2026-10-22",
      created: at(10, 5),
    },
    // 멈춤은 기한이 지나도 기한 초과가 아니다
    {
      n: 9,
      status: "on_hold",
      team: "t1",
      assignee: "a",
      due: "2026-10-01",
      created: at(9, 20),
    },
    { n: 10, status: "cancelled", created: at(9, 1) },
    {
      n: 11,
      status: "unresolved",
      assignee: "a",
      due: "2026-10-01",
      created: at(10, 20),
      deleted: true,
    },
    { n: 1, status: "unresolved", group: "g2", created: at(10, 20) },
  ];
  await t.db
    .insertInto("posts")
    .values(
      posts.map((p) => {
        const group = p.group ?? "g1";
        const key = `${group === "g1" ? "FD" : "DX"}-${p.n}`;
        return {
          id: key,
          group_id: group,
          seq: p.n,
          key,
          team_id: p.team ?? null,
          post_type_id: p.type ?? null,
          format: "image" as const,
          title: `${key} 제목`,
          status: p.status,
          author_id: p.author ?? "a",
          assignee_id: p.assignee ?? null,
          due_date: p.due ?? null,
          created_at: p.created,
          updated_at: p.updated ?? p.resolved ?? p.created,
          resolved_at: p.resolved ?? null,
          deleted_at: p.deleted ? p.created : null,
        };
      }),
    )
    .execute();

  let seq = 0;
  const ev = (
    post: string,
    actor: string,
    kind: string,
    when: Date,
    extra: { old?: string; new?: string } = {},
  ) => ({
    id: `e${String(++seq).padStart(2, "0")}`,
    post_id: post,
    actor_id: actor,
    kind,
    old_value: extra.old ?? null,
    new_value: extra.new ?? null,
    created_at: when,
  });
  await t.db
    .insertInto("events")
    .values([
      ev("FD-7", "a", "created", at(10, 18, 23, 59)),
      ev("FD-9", "b", "comment", at(10, 19, 0, 0)),
      ev("FD-3", "b", "created", at(10, 20, 9)),
      ev("FD-11", "a", "comment", at(10, 20, 10)),
      ev("DX-1", "b", "comment", at(10, 20, 11)),
      ev("FD-3", "b", "approved", at(10, 21, 9)),
      ev("FD-3", "b", "status", at(10, 21, 9), {
        old: "in_review",
        new: "resolved",
      }),
      ev("FD-1", "b", "approved", at(10, 21, 10)),
      ev("FD-1", "b", "status", at(10, 21, 10), {
        old: "in_review",
        new: "resolved",
      }),
      ev("FD-2", "a", "approved", at(10, 22, 10)),
      ev("FD-2", "a", "status", at(10, 22, 10), {
        old: "in_review",
        new: "resolved",
      }),
      ev("FD-5", "a", "review_requested", at(10, 20, 8)),
      ev("FD-5", "a", "review_requested", at(10, 22, 21)),
      ev("FD-5", "a", "status", at(10, 22, 21), {
        old: "in_progress",
        new: "in_review",
      }),
      ev("FD-8", "a", "comment", at(10, 22, 22)),
      ev("FD-7", "a", "overdue", at(10, 23, 8)),
      ev("FD-8", "b", "comment", at(10, 24, 0, 0)),
    ])
    .execute();
  return t;
}

const activity = (t: TestFeed, args: Record<string, unknown>, actor = "a") =>
  t.run(
    "reports.activity",
    { groupId: "FD", from: "2026-10-19", to: "2026-10-23", ...args },
    { actor, now: NOW },
  );

const status = (t: TestFeed, args: Record<string, unknown> = {}, actor = "a") =>
  t.run("reports.status", { groupId: "FD", ...args }, { actor, now: NOW });

const entryIds = (r: Awaited<ReturnType<typeof activity>>) =>
  r.days.flatMap((d) => d.entries.map((e) => e.event.id));

describe("reports.activity", () => {
  it("기간 [from 자정, to+1 자정)의 사람 이벤트를 날짜·시각 순으로, 지운 게시물·다른 그룹·시스템 이벤트는 뺀다", async () => {
    const t = await setup();
    const r = await activity(t, {});
    expect(r.group).toEqual({ id: "g1", name: "피드", keyPrefix: "FD" });
    expect(r.days.map((d) => d.date)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(entryIds(r)).toEqual([
      "e02",
      "e12",
      "e03",
      "e06",
      "e07",
      "e08",
      "e09",
      "e10",
      "e11",
      "e13",
      "e14",
      "e15",
    ]);
    expect(r.days[1].entries.map((e) => e.event.id)).toEqual(["e12", "e03"]);
  });

  it("하루만 고르면 그날 이벤트만, 항목에 게시물 참조가 붙는다", async () => {
    const t = await setup();
    const r = await activity(t, { from: "2026-10-20", to: "2026-10-20" });
    expect(entryIds(r)).toEqual(["e12", "e03"]);
    expect(r.days[0].entries[1]).toMatchObject({
      event: { kind: "created", actorId: "b", postId: "FD-3" },
      post: {
        key: "FD-3",
        title: "FD-3 제목",
        status: "resolved",
        groupId: "g1",
      },
    });
  });

  it("해결·생성 게시물과 사람별 수 (완료 = 승인한 수)", async () => {
    const t = await setup();
    const r = await activity(t, {});
    expect(r.completed.map((c) => [c.post.key, c.assigneeId])).toEqual([
      ["FD-3", "b"],
      ["FD-1", "a"],
      ["FD-2", "a"],
    ]);
    expect(r.completed[0].resolvedAt).toBe(at(10, 21, 9).toISOString());
    expect(r.created.map((p) => p.key)).toEqual(["FD-3"]);
    expect(r.byUser).toEqual([
      { userId: "a", events: 6, completed: 1 },
      { userId: "b", events: 6, completed: 2 },
    ]);
  });

  it("팀·게시물 유형·담당자로 거른다", async () => {
    const t = await setup();
    const team = await activity(t, { teamId: "t1" });
    expect(entryIds(team)).toEqual([
      "e02",
      "e12",
      "e03",
      "e06",
      "e07",
      "e08",
      "e09",
      "e13",
      "e14",
    ]);
    expect(team.completed.map((c) => c.post.key)).toEqual(["FD-3", "FD-1"]);

    const type = await activity(t, { postTypeIds: ["pt2"] });
    expect(entryIds(type)).toEqual(["e10", "e11", "e15"]);
    expect(type.created).toEqual([]);
    expect((await activity(t, { postTypeIds: [] })).days).toHaveLength(4);

    // a가 한 일 + a가 담당인 게시물의 일
    const mine = await activity(t, { assigneeId: "a" });
    expect(entryIds(mine)).toEqual([
      "e02",
      "e12",
      "e08",
      "e09",
      "e10",
      "e11",
      "e13",
      "e14",
      "e15",
    ]);
    expect(mine.completed.map((c) => c.post.key)).toEqual(["FD-1", "FD-2"]);
    expect(mine.created).toEqual([]);
    expect(
      (await activity(t, { assigneeId: "b" })).created.map((p) => p.key),
    ).toEqual(["FD-3"]);
  });

  it("기간 검사: from > to, 366일 넘음은 400. 366일까지는 된다", async () => {
    const t = await setup();
    await expect(
      activity(t, { from: "2026-10-23", to: "2026-10-22" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      activity(t, { from: "2025-10-22", to: "2026-10-23" }),
    ).rejects.toMatchObject({ status: 400 });
    const year = await activity(t, { from: "2025-10-23", to: "2026-10-23" });
    expect(year.created.map((p) => p.key)).toEqual([
      "FD-4",
      "FD-10",
      "FD-9",
      "FD-1",
      "FD-8",
      "FD-5",
      "FD-2",
      "FD-6",
      "FD-7",
      "FD-3",
    ]);
  });

  it("비공개 그룹은 멤버가 아니면 404, 다른 그룹의 팀은 400, 사용자 없으면 401", async () => {
    const t = await setup();
    await expect(activity(t, { groupId: "DX" }, "c")).rejects.toMatchObject({
      status: 404,
    });
    const dx = await activity(t, { groupId: "DX" }, "b");
    expect(entryIds(dx)).toEqual(["e05"]);
    await expect(activity(t, { teamId: "t9" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      t.run(
        "reports.activity",
        { groupId: "FD", from: "2026-10-19", to: "2026-10-23" },
        { actor: null, now: NOW },
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("reports.status", () => {
  it("상태별 수·기한 초과·담당자별 부하·검토 대기·리드타임·목록", async () => {
    const t = await setup();
    const r = await status(t);
    expect(r.byStatus).toEqual({
      unresolved: 1,
      in_progress: 1,
      in_review: 2,
      on_hold: 1,
      resolved: 4,
      cancelled: 1,
    });
    expect(r.overdue).toBe(2);
    expect(r.assigneeLoad).toEqual([
      { userId: "a", open: 2, inReview: 1, overdue: 1 },
      { userId: "b", open: 1, inReview: 0, overdue: 1 },
      { userId: null, open: 1, inReview: 1, overdue: 0 },
    ]);
    // FD-5: 마지막 완료 요청(10/22 21:00)부터 12시간, FD-6: 요청 없음 → 수정(10/23 03:00)부터 6시간
    expect(r.reviewWait).toEqual({ count: 2, avgHours: 9, maxHours: 12 });
    expect(r.leadTime30d).toEqual({ count: 3, avgDays: 10, medianDays: 9 });
    expect(r.posts.map((p) => p.key)).toEqual([
      "FD-5",
      "FD-8",
      "FD-9",
      "FD-7",
      "FD-6",
    ]);
    expect(r.posts[0]).toMatchObject({
      category: "open",
      dueDate: "2026-10-20",
      assigneeId: "a",
      commentCount: 0,
    });
  });

  it("소수 한 자리로 반올림, 비어 있으면 0", async () => {
    const t = await setup();
    // 13시간 20분 뒤: FD-5 25.3시간, FD-6 19.3시간
    const later = await t.run(
      "reports.status",
      { groupId: "FD" },
      { actor: "a", now: at(10, 23, 22, 20) },
    );
    expect(later.reviewWait).toEqual({
      count: 2,
      avgHours: 22.3,
      maxHours: 25.3,
    });
    const dx = await status(t, { groupId: "DX" }, "b");
    expect(dx.reviewWait).toEqual({ count: 0, avgHours: 0, maxHours: 0 });
    expect(dx.leadTime30d).toEqual({ count: 0, avgDays: 0, medianDays: 0 });
    expect(dx.assigneeLoad).toEqual([
      { userId: null, open: 1, inReview: 0, overdue: 0 },
    ]);
  });

  it("팀으로 거른다", async () => {
    const t = await setup();
    const r = await status(t, { teamId: "t1" });
    expect(r.byStatus).toEqual({
      unresolved: 1,
      in_progress: 0,
      in_review: 1,
      on_hold: 1,
      resolved: 2,
      cancelled: 0,
    });
    expect(r.overdue).toBe(1);
    // FD-1 20일, FD-3 1일
    expect(r.leadTime30d).toEqual({
      count: 2,
      avgDays: 10.5,
      medianDays: 10.5,
    });
    expect(r.posts.map((p) => p.key)).toEqual(["FD-5", "FD-9", "FD-7"]);
  });

  it("비공개 그룹은 멤버가 아니면 404", async () => {
    const t = await setup();
    await expect(status(t, { groupId: "DX" }, "c")).rejects.toMatchObject({
      status: 404,
    });
    await expect(status(t, { groupId: "NOPE" })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("reports.templates", () => {
  async function withTemplates() {
    const t = await setup();
    await t.db
      .insertInto("report_templates")
      .values([
        {
          id: "rt_b",
          owner_id: "b",
          group_id: "g1",
          name: "주간 업무 보고",
          kind: "activity",
          params: JSON.stringify({ rangeDays: 7, postTypeIds: ["pt1"] }),
        },
        {
          id: "rt_dx",
          owner_id: "b",
          group_id: "g2",
          name: "DX 현황",
          kind: "status",
          params: "{}",
        },
      ])
      .execute();
    return t;
  }

  it("그룹을 볼 수 있으면 목록을 보고, editable은 만든 사람·그룹 관리자", async () => {
    const t = await withTemplates();
    const asC = await t.run(
      "reports.templates.list",
      { groupId: "FD" },
      { actor: "c" },
    );
    expect(asC.templates).toEqual([
      {
        id: "rt_b",
        ownerId: "b",
        groupId: "g1",
        name: "주간 업무 보고",
        kind: "activity",
        params: { rangeDays: 7, postTypeIds: ["pt1"] },
        editable: false,
      },
    ]);
    const asB = await t.run(
      "reports.templates.list",
      { groupId: "g1" },
      { actor: "b" },
    );
    expect(asB.templates[0].editable).toBe(true);
    await expect(
      t.run("reports.templates.list", { groupId: "DX" }, { actor: "c" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("만들기는 그룹 멤버, 고치기·지우기는 만든 사람이나 그룹 관리자", async () => {
    const t = await withTemplates();
    const body = {
      groupId: "FD",
      name: "내 보고",
      kind: "activity" as const,
      params: { rangeDays: 14, teamId: "t1" },
    };
    await expect(
      t.run("reports.templates.save", body, { actor: "c" }),
    ).rejects.toMatchObject({ status: 403 });
    const mine = await t.run("reports.templates.save", body, { actor: "a" });
    expect(mine).toMatchObject({ ownerId: "a", groupId: "g1", editable: true });

    // a는 b의 템플릿을 못 고치고, 관리자 b는 a의 템플릿을 고친다
    await expect(
      t.run("reports.templates.save", { ...body, id: "rt_b" }, { actor: "a" }),
    ).rejects.toMatchObject({ status: 403 });
    const renamed = await t.run(
      "reports.templates.save",
      { ...body, id: mine.id, name: "고친 이름", params: {} },
      { actor: "b" },
    );
    expect(renamed).toMatchObject({
      id: mine.id,
      ownerId: "a",
      name: "고친 이름",
      params: {},
    });

    await expect(
      t.run(
        "reports.templates.delete",
        { templateId: mine.id },
        { actor: "c" },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      t.run(
        "reports.templates.delete",
        { templateId: "rt_dx" },
        { actor: "c" },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      t.run("reports.templates.delete", { templateId: "nope" }, { actor: "a" }),
    ).rejects.toMatchObject({ status: 404 });
    await t.run(
      "reports.templates.delete",
      { templateId: mine.id },
      { actor: "a" },
    );
    const left = await t.run(
      "reports.templates.list",
      { groupId: "FD" },
      { actor: "a" },
    );
    expect(left.templates.map((x) => x.id)).toEqual(["rt_b"]);
  });

  it("다른 그룹의 팀·유형, 그룹 바꾸기는 400", async () => {
    const t = await withTemplates();
    const body = { groupId: "FD", name: "x", kind: "activity" as const };
    await expect(
      t.run(
        "reports.templates.save",
        { ...body, params: { teamId: "t9" } },
        { actor: "a" },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run(
        "reports.templates.save",
        { ...body, params: { postTypeIds: ["nope"] } },
        { actor: "a" },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run("reports.templates.save", { ...body, id: "rt_dx" }, { actor: "b" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("기본 시나리오", () => {
  it("주간 보고와 현황 숫자가 서로 맞는다", async () => {
    const t = await createTestFeed();
    await t.run("seed.load", { scenario: "default" }, { now: NOW });
    const opts = { actor: "u1", now: NOW };
    const { templates } = await t.run(
      "reports.templates.list",
      { groupId: "FD" },
      opts,
    );
    expect(templates.map((x) => x.id)).toEqual([
      "rt_fd_weekly",
      "rt_fd_monthly",
    ]);

    const week = await t.run(
      "reports.activity",
      { groupId: "FD", from: localDay(NOW, -6), to: localDay(NOW) },
      opts,
    );
    expect(week.days.length).toBeGreaterThan(0);
    const all = week.days.flatMap((d) => d.entries);
    const times = all.map((e) => e.event.createdAt);
    expect([...times].sort()).toEqual(times);
    expect(
      all.every((e) => !["due_soon", "overdue"].includes(e.event.kind)),
    ).toBe(true);
    expect(week.byUser.reduce((n, u) => n + u.events, 0)).toBe(all.length);
    expect(week.byUser.reduce((n, u) => n + u.completed, 0)).toBe(
      all.filter((e) => e.event.kind === "approved").length,
    );

    const worklog = await t.run(
      "reports.activity",
      {
        groupId: "FD",
        from: localDay(NOW, -6),
        to: localDay(NOW),
        postTypeIds: ["pt_fd_worklog"],
      },
      opts,
    );
    expect(worklog.days.flatMap((d) => d.entries).length).toBeLessThanOrEqual(
      all.length,
    );

    const s = await t.run("reports.status", { groupId: "FD" }, opts);
    const total = Object.values(s.byStatus).reduce((a, b) => a + b, 0);
    const { total: listed } = await t.run(
      "posts.query",
      { filter: { groupIds: [s.group.id] }, limit: 1 },
      opts,
    );
    expect(total).toBe(listed);
    expect(s.posts.length).toBe(
      s.byStatus.unresolved +
        s.byStatus.in_progress +
        s.byStatus.in_review +
        s.byStatus.on_hold,
    );
    expect(s.assigneeLoad.reduce((n, l) => n + l.open, 0)).toBe(
      s.byStatus.unresolved + s.byStatus.in_progress + s.byStatus.in_review,
    );
    expect(s.reviewWait.count).toBe(s.byStatus.in_review);
    expect(s.overdue).toBeGreaterThan(0);
    expect(s.leadTime30d.count).toBeGreaterThan(0);
  });
});
