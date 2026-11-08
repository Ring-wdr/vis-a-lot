// comments API를 HTTP로 한 바퀴: 상태 코드(쓰기·첨부 201, 지우기 204), body 검증, 볼 수 없는 게시물 404.
// DB Worker 대신 테스트 DB에서 op를 바로 돌린다.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runFeedOp } from "../runner";
import { createTestFeed, type TestFeed } from "../test-db";

let t: TestFeed;

vi.mock("../../runtime", () => ({
  getRuntime: () => ({
    db: { call: (_method: string, req: never) => runFeedOp(t.db, req) },
  }),
}));

const { feedApp } = await import("../../services/feed/app");

const call = (method: string, path: string, body?: unknown, user = "a") =>
  feedApp.request(path, {
    method,
    headers: { "x-feed-user": user, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

beforeEach(async () => {
  t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "a", name: "가" },
      { id: "b", name: "나" },
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
    .values({ group_id: "g_dx", user_id: "b", role: "member" })
    .execute();
  await t.run("posts.create", { groupId: "FD", title: "글" }, { actor: "a" });
  await t.run(
    "posts.create",
    { groupId: "DX", title: "비공개" },
    { actor: "b" },
  );
});

describe("comments API", () => {
  it("쓰기 201, 목록, 반응, 해결, 지우기 204", async () => {
    const created = await call("POST", "/posts/FD-1/comments", {
      body: doc("첫 댓글"),
    });
    expect(created.status).toBe(201);
    const comment = await created.json();
    expect(comment).toMatchObject({ authorId: "a", parentId: null });

    const empty = await call("POST", "/posts/FD-1/comments", {});
    expect(empty.status).toBe(400);
    const hidden = await call("POST", "/posts/DX-1/comments", {
      body: doc("몰래"),
    });
    expect(hidden.status).toBe(404);

    const reacted = await call("PUT", `/comments/${comment.id}/reactions`, {
      emoji: "👍",
      on: true,
    });
    expect((await reacted.json()).reactions).toEqual([
      { emoji: "👍", count: 1, mine: true },
    ]);
    const resolved = await call("PUT", `/comments/${comment.id}/resolve`, {
      on: true,
    });
    expect((await resolved.json()).resolved).toBe(true);

    const list = await call("GET", "/posts/FD-1/comments");
    expect((await list.json()).threads).toHaveLength(1);

    const removed = await call("DELETE", `/comments/${comment.id}`);
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");
  });

  it("투표, 첨부 201·204", async () => {
    const created = await call("POST", "/posts/FD-1/comments", {
      body: null,
      poll: { question: "고르기", options: ["가", "나"] },
    });
    const { poll } = await created.json();
    const voted = await call("PUT", `/polls/${poll.id}/vote`, { optionIdx: 1 });
    expect((await voted.json()).poll).toMatchObject({
      votes: [0, 1],
      myVote: 1,
    });

    const added = await call("POST", "/posts/FD-1/attachments", {
      kind: "link",
      name: "문서",
      url: "https://example.com",
    });
    expect(added.status).toBe(201);
    const attachment = await added.json();
    const forbidden = await call(
      "DELETE",
      `/posts/FD-1/attachments/${attachment.id}`,
      undefined,
      "b",
    );
    expect(forbidden.status).toBe(403);
    const removed = await call(
      "DELETE",
      `/posts/FD-1/attachments/${attachment.id}`,
    );
    expect(removed.status).toBe(204);
  });
});
