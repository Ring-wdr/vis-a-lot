import { beforeAll, describe, expect, it } from "vitest";
import { FEED_SCHEMA_VERSION } from "./ddl";
import type { FeedSnapshot } from "./seed";
import { createTestFeed, type TestFeed } from "./test-db";
import { day, localDay } from "./time";

const NOW = new Date("2026-10-23T09:00:00+09:00");

async function seeded() {
  const t = await createTestFeed();
  const started = performance.now();
  await t.run("seed.load", { scenario: "default" }, { now: NOW });
  return { t, ms: performance.now() - started };
}

const countBy = (rows: Record<string, unknown>[], key: string) =>
  rows.reduce<Record<string, number>>((acc, r) => {
    const k = String(r[key]);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

const OPEN = ["unresolved", "in_progress", "in_review"];

async function snapshot(t: TestFeed) {
  return t.run("seed.export", undefined, { now: NOW });
}

describe("seed.load default", () => {
  let loaded: FeedSnapshot;
  let loadMs = 0;
  beforeAll(async () => {
    const { t, ms } = await seeded();
    loadMs = ms;
    loaded = await snapshot(t);
  });

  it("스펙의 분포대로 채우고 빠르다", () => {
    expect(loadMs).toBeLessThan(5000);
    const { tables } = loaded;
    const posts = tables.posts;
    const today = localDay(NOW);
    const week = localDay(NOW, 6);

    expect(tables.users).toHaveLength(8);
    expect(tables.users.find((u) => u.id === "u3")?.is_admin).toBe(true);
    expect(tables.groups.map((g) => [g.key_prefix, g.is_private])).toEqual([
      ["DX", true],
      ["FD", false],
    ]);
    expect(tables.teams).toHaveLength(4);
    expect(tables.post_types).toHaveLength(10);

    expect(posts).toHaveLength(60);
    expect(countBy(posts, "status")).toEqual({
      unresolved: 20,
      in_progress: 15,
      in_review: 6,
      resolved: 12,
      on_hold: 4,
      cancelled: 3,
    });
    expect(countBy(posts, "format")).toEqual({
      image: 30,
      chart: 15,
      code: 10,
      video: 5,
    });
    const open = posts.filter((p) => OPEN.includes(String(p.status)));
    // 기한 없는 게시물은 ''로 두어 비교에서 빠진다 ('' < 어떤 날짜)
    const due = (p: (typeof posts)[number]) => String(p.due_date ?? "");
    expect(open.filter((p) => due(p) && due(p) < today)).toHaveLength(5);
    expect(open.filter((p) => due(p) >= today && due(p) <= week)).toHaveLength(
      8,
    );

    // 키와 next_seq
    for (const g of tables.groups) {
      const mine = posts.filter((p) => p.group_id === g.id);
      expect(g.next_seq).toBe(mine.length + 1);
      const byCreated = [...mine].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
      expect(byCreated.map((p) => p.key)).toEqual(
        byCreated.map((_, i) => `${g.key_prefix}-${i + 1}`),
      );
    }

    // 상태별 필드
    for (const p of posts) {
      expect(p.resolved_at != null).toBe(p.status === "resolved");
      if (p.status === "on_hold") {
        expect(["dependency", "decision", "resource"]).toContain(
          p.close_reason,
        );
        expect(String(p.hold_until) > today).toBe(true);
      }
      if (p.status === "cancelled")
        expect([
          "duplicate",
          "cannot_reproduce",
          "out_of_scope",
          "low_priority",
        ]).toContain(p.close_reason);
      expect(String(p.thumbnail).startsWith("data:image/svg+xml,")).toBe(true);
      expect(String(p.thumbnail).length).toBeLessThan(2048);
    }
    const review = posts.filter((p) => p.status === "in_review");
    expect(review.filter((p) => p.requester_id === "u1")).toHaveLength(2);

    // 상위 진행률 = 해결된 하위 비율
    const parents = posts.filter((p) =>
      posts.some((c) => c.parent_id === p.id),
    );
    expect(parents).toHaveLength(3);
    for (const parent of parents) {
      const children = posts.filter((c) => c.parent_id === parent.id);
      expect(children.length).toBeGreaterThanOrEqual(3);
      expect(children.every((c) => c.group_id === parent.group_id)).toBe(true);
      const done = children.filter((c) => c.status === "resolved").length;
      expect(parent.progress).toBe(Math.round((100 * done) / children.length));
    }
    expect(countBy(tables.post_relations, "kind")).toEqual({
      blocks: 2,
      duplicate: 1,
    });
    // 체크리스트 진행률
    const lists = Object.groupBy(tables.checklist_items, (c) =>
      String(c.post_id),
    );
    expect(Object.keys(lists).length).toBeGreaterThanOrEqual(10);
    for (const [postId, items = []] of Object.entries(lists)) {
      const p = posts.find((x) => x.id === postId);
      const done = items.filter((c) => c.done).length;
      expect(p?.progress).toBe(Math.round((100 * done) / items.length));
    }

    // 댓글
    expect(tables.comments).toHaveLength(120);
    expect(tables.comments.filter((c) => c.parent_id)).toHaveLength(40);
    expect(tables.reactions).toHaveLength(60);
    expect(tables.polls).toHaveLength(1);
    expect(tables.poll_votes.length).toBeGreaterThan(0);
    const mentions = tables.comments.filter((c) =>
      JSON.stringify(c.body).includes('"type":"mention"'),
    );
    expect(mentions).toHaveLength(15);
    expect(tables.events.filter((e) => e.kind === "mention")).toHaveLength(15);
    expect(tables.events.filter((e) => e.kind === "comment")).toHaveLength(120);

    // 저장된 뷰·보고 템플릿
    expect(tables.saved_views).toHaveLength(5);
    const fdDue = tables.saved_views.find((v) => v.id === "v_fd_due");
    expect(fdDue?.filter).toEqual({
      groupIds: ["g_fd"],
      dueFrom: today,
      dueTo: week,
      categories: ["open"],
    });
    expect(tables.saved_views.filter((v) => v.shared && v.pinned)).toHaveLength(
      4,
    );
    expect(tables.report_templates).toHaveLength(2);
  });

  it("이벤트가 최종 상태와 맞고 시각이 게시물마다 늘어난다", () => {
    const { tables } = loaded;
    const nowIso = NOW.toISOString();
    for (const p of tables.posts) {
      const events = tables.events
        .filter((e) => e.post_id === p.id)
        .sort((a, b) =>
          String(a.created_at).localeCompare(String(b.created_at)),
        );
      expect(events[0]).toMatchObject({
        kind: "created",
        created_at: p.created_at,
      });
      for (let i = 1; i < events.length; i++)
        expect(
          String(events[i].created_at) > String(events[i - 1].created_at),
        ).toBe(true);
      expect(String(events.at(-1)?.created_at) < nowIso).toBe(true);
      const statuses = events.filter((e) => e.kind === "status");
      expect(statuses.at(-1)?.new_value ?? "unresolved").toBe(p.status);
      for (let i = 1; i < statuses.length; i++)
        expect(statuses[i].old_value).toBe(statuses[i - 1].new_value);
      if (p.status === "resolved")
        expect(events.some((e) => e.kind === "approved")).toBe(true);
      if (p.status === "in_review")
        expect(
          events.at(-1)?.kind === "review_requested" ||
            events.some((e) => e.kind === "review_requested"),
        ).toBe(true);
    }
    // 댓글은 게시물보다 뒤, 대댓글은 부모보다 뒤
    const byId = new Map(tables.comments.map((c) => [c.id, c]));
    for (const c of tables.comments) {
      const post = tables.posts.find((p) => p.id === c.post_id);
      expect(String(c.created_at) > String(post?.created_at)).toBe(true);
      if (c.parent_id)
        expect(
          String(c.created_at) >
            String(byId.get(String(c.parent_id))?.created_at),
        ).toBe(true);
    }
  });

  it("u1 알림: 안읽음 10개(승인 대기 2건 포함)와 읽음 15개", () => {
    const { tables } = loaded;
    const events = new Map(tables.events.map((e) => [e.id, e]));
    const mine = tables.notifications.filter((n) => n.user_id === "u1");
    const unread = mine.filter(
      (n) => n.read_at == null && n.archived_at == null,
    );
    expect(unread).toHaveLength(10);
    expect(mine.filter((n) => n.read_at != null)).toHaveLength(15);
    for (const n of mine)
      expect(events.get(String(n.event_id))?.actor_id).not.toBe("u1");
    const reviewIds = tables.posts
      .filter((p) => p.status === "in_review" && p.requester_id === "u1")
      .map((p) => p.id);
    const reviewUnread = unread.filter((n) => {
      const e = events.get(String(n.event_id));
      return (
        e?.kind === "review_requested" && reviewIds.includes(String(e.post_id))
      );
    });
    expect(reviewUnread).toHaveLength(2);
    expect(tables.notifications.some((n) => n.user_id !== "u1")).toBe(true);
    expect(tables.outbox.length).toBeGreaterThan(0);
    // 비공개 그룹 알림은 멤버에게만
    const dxMembers = tables.group_members
      .filter((m) => m.group_id === "g_dx")
      .map((m) => m.user_id);
    for (const n of tables.notifications) {
      const post = tables.posts.find(
        (p) => p.id === events.get(String(n.event_id))?.post_id,
      );
      if (post?.group_id === "g_dx") expect(dxMembers).toContain(n.user_id);
    }
  });

  it("같은 now면 같은 결과", async () => {
    // TestFeed는 한 번에 하나만 쓴다: 첫 결과는 JSON만 들고 다시 만든다
    const { t } = await seeded();
    const again = await snapshot(t);
    expect(again).toEqual(loaded);
  });

  it("비어 있지 않으면 409", async () => {
    const { t } = await seeded();
    await expect(
      t.run("seed.load", { scenario: "default" }, { now: NOW }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("system.status가 적재 결과를 센다", async () => {
    const { t } = await seeded();
    expect(await t.run("system.status", undefined)).toEqual({
      users: 8,
      posts: 60,
    });
  });
});

describe("seed.export / seed.import", () => {
  it("내보내기 → 가져오기 → 내보내기가 같다", async () => {
    const first = await snapshot((await seeded()).t);
    expect(first.schemaVersion).toBe(FEED_SCHEMA_VERSION);
    expect(first.tables.meta).toBeUndefined();
    expect(day(String(first.tables.posts[0].created_at))).toMatch(/^\d{4}-/);
    const total = Object.values(first.tables).reduce(
      (n, rows) => n + rows.length,
      0,
    );

    // 빈 DB에 가져오기
    const t = await createTestFeed();
    const later = new Date(NOW.getTime() + 60_000);
    const copy = JSON.parse(JSON.stringify(first)) as FeedSnapshot;
    expect(await t.run("seed.import", copy, { now: later })).toEqual({
      rows: total,
    });
    const second = await t.run("seed.export", undefined, { now: later });
    expect({ ...second, exportedAt: "" }).toEqual({ ...first, exportedAt: "" });

    // 이미 찬 DB에 가져와도 지우고 다시 채운다
    expect(await t.run("seed.import", copy)).toEqual({ rows: total });
    expect(await snapshot(t)).toEqual(first);
  });

  it("버전이 다르거나 모르는 테이블이면 400", async () => {
    const t = await createTestFeed();
    await expect(
      t.run("seed.import", { schemaVersion: 999, exportedAt: "", tables: {} }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run("seed.import", {
        schemaVersion: FEED_SCHEMA_VERSION,
        exportedAt: "",
        tables: { nope: [] },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run("seed.import", {
        schemaVersion: FEED_SCHEMA_VERSION,
        exportedAt: "",
        tables: { meta: [] },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
