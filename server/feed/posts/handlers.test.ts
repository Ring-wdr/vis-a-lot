// posts API를 HTTP로 한 바퀴: route 순서(/posts/my-summary가 /posts/{postId}에 잡히지 않음), 상태 코드, body 검증.
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

const call = (method: string, path: string, body?: unknown) =>
  feedApp.request(path, {
    method,
    headers: { "x-feed-user": "a", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(async () => {
  t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([{ id: "a", name: "가" }])
    .execute();
  await t.db
    .insertInto("groups")
    .values({ id: "g_fd", name: "피드", key_prefix: "FD" })
    .execute();
});

describe("posts API", () => {
  it("만들기 201, 요약, 목록, 전이, 지우기 204", async () => {
    const created = await call("POST", "/posts", {
      groupId: "FD",
      title: "첫 글",
      assigneeId: "a",
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      key: "FD-1",
      format: "image",
    });

    const summary = await call("GET", "/posts/my-summary");
    expect(summary.status).toBe(200);
    expect(await summary.json()).toEqual({
      assigned: 1,
      awaitingReview: 0,
      dueSoon: 0,
    });

    const list = await call("POST", "/posts/query", {});
    expect((await list.json()).total).toBe(1);

    const moved = await call("POST", "/posts/FD-1/transition", {
      to: "in_progress",
    });
    expect((await moved.json()).status).toBe("in_progress");
    const bad = await call("POST", "/posts/FD-1/transition", { to: "nope" });
    expect(bad.status).toBe(400);
    const conflict = await call("POST", "/posts/FD-1/transition", {
      to: "resolved",
    });
    expect(conflict.status).toBe(409);

    const removed = await call("DELETE", "/posts/FD-1");
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");
    expect((await call("GET", "/posts/FD-1")).status).toBe(404);
  });
});
