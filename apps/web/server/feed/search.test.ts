import { beforeEach, describe, expect, it, vi } from "vitest";
import { runFeedOp } from "./runner";
import { snippetOf, tiptapText } from "./search";
import { createTestFeed, type TestFeed } from "./test-db";

let t: TestFeed;

vi.mock("../runtime", () => ({
  getRuntime: () => ({
    db: { call: (_method: string, req: never) => runFeedOp(t.db, req) },
  }),
}));

const { feedApp } = await import("../services/feed/app");

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

let seq = 0;
const post = (
  id: string,
  key: string,
  title: string,
  extra: { group?: string; body?: string; deleted?: boolean } = {},
) => ({
  id,
  key,
  seq: ++seq,
  group_id: extra.group ?? "g1",
  format: "code" as const,
  title,
  body: extra.body ? doc(extra.body) : null,
  author_id: "u1",
  deleted_at: extra.deleted ? new Date().toISOString() : null,
});

// u1 FD 멤버, u2 DX(비공개) 멤버, u3 시스템 관리자
beforeEach(async () => {
  seq = 0;
  t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "가" },
      { id: "u2", name: "나" },
      { id: "u3", name: "다", is_admin: true },
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
      { group_id: "g1", user_id: "u1", role: "member" },
      { group_id: "g2", user_id: "u2", role: "member" },
    ])
    .execute();
  await t.db
    .insertInto("posts")
    .values([
      post("p1", "FD-1", "로그인 오류"),
      post("p10", "FD-10", "차트 색 바꾸기", {
        body: "범례 색이 로그인 화면과 다르다",
      }),
      post("p12", "FD-12", "대시보드 느림"),
      post("p112", "FD-112", "배포 체크"),
      post("p3", "FD-3", "지운 로그인 글", { deleted: true }),
      post("d12", "DX-12", "비공개 로그인", { group: "g2" }),
      post("p4", "FD-4", "질문 하나"),
    ])
    .execute();
  await t.db
    .insertInto("comments")
    .values([
      {
        id: "c1",
        post_id: "p4",
        author_id: "u1",
        body: doc("이건 로그인 문제 같아요"),
      },
      {
        id: "c2",
        post_id: "p12",
        author_id: "u1",
        body: doc("지운 댓글의 로그인"),
        deleted_at: new Date().toISOString(),
      },
    ])
    .execute();
});

const keys = async (q: string, actor = "u1", limit?: number) =>
  (await t.run("search.posts", { q, limit }, { actor })).hits.map(
    (h) => `${h.key}:${h.matchedIn}`,
  );

describe("search.posts", () => {
  it("빈 검색어는 빈 결과", async () => {
    expect(await keys("  ")).toEqual([]);
  });

  it("이슈 키: 정확 → 앞부분 → 번호 일부", async () => {
    expect((await keys("fd-12"))[0]).toBe("FD-12:key");
    expect(await keys("fd-1")).toEqual([
      "FD-1:key",
      "FD-10:key",
      "FD-12:key",
      "FD-112:key",
    ]);
    // 번호만: 번호가 12로 시작하는 것이 포함만 하는 것보다 앞
    expect(await keys("12")).toEqual(["FD-12:key", "FD-112:key"]);
    expect(await keys("FD")).toHaveLength(5);
  });

  it("제목 → 본문 → 댓글 순, 한 게시물은 한 번만", async () => {
    const hits = (await t.run("search.posts", { q: "로그인" }, { actor: "u1" }))
      .hits;
    expect(hits.map((h) => `${h.key}:${h.matchedIn}`)).toEqual([
      "FD-1:title",
      "FD-10:body",
      "FD-4:comment",
    ]);
    expect(hits[0].snippet).toBeNull();
    expect(hits[1].snippet).toBe("범례 색이 로그인 화면과 다르다");
    expect(hits[2].snippet).toBe("이건 로그인 문제 같아요");
  });

  it("비공개 그룹은 멤버와 시스템 관리자만, 지운 글·댓글은 빠진다", async () => {
    expect(await keys("비공개", "u1")).toEqual([]);
    expect(await keys("비공개", "u2")).toEqual(["DX-12:title"]);
    expect(await keys("DX-12", "u3")).toEqual(["DX-12:key"]);
    expect(await keys("지운")).toEqual([]);
  });

  it("JSON 구조 글자로는 맞추지 않고, limit을 지킨다", async () => {
    expect(await keys("paragraph")).toEqual([]);
    expect(await keys("FD", "u1", 2)).toHaveLength(2);
  });
});

describe("snippet", () => {
  it("본문 글만 뽑고 주변 60자 정도로 자른다", () => {
    expect(
      tiptapText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "가나" }] },
          { type: "paragraph", content: [{ type: "text", text: "다라" }] },
        ],
      }),
    ).toBe("가나 다라");
    const long = `${"앞".repeat(100)}찾는말${"뒤".repeat(100)}`;
    const s = snippetOf(long, "찾는말") ?? "";
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s).toContain("찾는말");
    expect(s.length).toBeLessThanOrEqual(62);
  });
});

describe("search API", () => {
  it("GET /search?q=&limit=", async () => {
    const res = await feedApp.request("/search?q=fd-1&limit=2", {
      headers: { "x-feed-user": "u1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hits).toHaveLength(2);
    expect(body.hits[0]).toMatchObject({
      key: "FD-1",
      matchedIn: "key",
      snippet: null,
      groupId: "g1",
    });
    expect((await feedApp.request("/search?q=x")).status).toBe(401);
  });
});
