// views API를 HTTP로 한 바퀴: 상태 코드(200·204·400·403), body 검증.
// DB Worker 대신 테스트 DB에서 op를 바로 돌린다.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runFeedOp } from "./runner";
import { createTestFeed, type TestFeed } from "./test-db";

let t: TestFeed;

vi.mock("../runtime", () => ({
  getRuntime: () => ({
    db: { call: (_method: string, req: never) => runFeedOp(t.db, req) },
  }),
}));

const { feedApp } = await import("../services/feed/app");

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

describe("views API", () => {
  it("목록, 저장, 고정, 지우기 204", async () => {
    const list = await call("GET", "/views");
    expect(list.status).toBe(200);
    expect((await list.json()).views.map((v: { id: string }) => v.id)).toEqual([
      "builtin-explore",
      "builtin-following",
    ]);

    const saved = await call("POST", "/views", {
      name: "내 뷰",
      layout: "list",
      groupId: "FD",
    });
    expect(saved.status).toBe(200);
    const view = await saved.json();
    expect(view).toMatchObject({ groupId: "g_fd", editable: true });

    expect(
      (await call("POST", "/views", { name: "", layout: "list" })).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "/views", {
          name: "x",
          layout: "feed",
          shared: true,
        })
      ).status,
    ).toBe(400);

    const pinned = await call("PUT", `/views/${view.id}/pin`, { on: true });
    expect((await pinned.json()).pinned).toBe(true);
    expect(
      (await call("PUT", "/views/builtin-explore/pin", { on: false })).status,
    ).toBe(403);

    const removed = await call("DELETE", `/views/${view.id}`);
    expect(removed.status).toBe(204);
    expect((await call("GET", `/views/${view.id}`)).status).toBe(404);
    expect((await call("GET", "/views/builtin-explore")).status).toBe(200);
  });
});
