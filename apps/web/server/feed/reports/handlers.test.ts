// reports API를 HTTP로 한 바퀴: 상태 코드, body·query 검증, 템플릿 저장·지우기 204.
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

beforeEach(async () => {
  t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "a", name: "가" },
      { id: "c", name: "다" },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values([
      { id: "g_fd", name: "피드", key_prefix: "FD" },
      { id: "g_dx", name: "데이터", key_prefix: "DX", is_private: true },
    ])
    .execute();
  await t.db
    .insertInto("group_members")
    .values({ group_id: "g_fd", user_id: "a", role: "member" })
    .execute();
});

describe("reports API", () => {
  it("활동·현황 200, 형식 오류·기간 오류 400, 비공개 404", async () => {
    await call("POST", "/posts", { groupId: "FD", title: "첫 글" });
    const today = new Date();
    const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const act = await call("POST", "/reports/activity", {
      groupId: "FD",
      from: d,
      to: d,
    });
    expect(act.status).toBe(200);
    const report = await act.json();
    expect(report.created.map((p: { key: string }) => p.key)).toEqual(["FD-1"]);
    expect(report.days[0].entries[0].event.kind).toBe("created");

    expect(
      (
        await call("POST", "/reports/activity", {
          groupId: "FD",
          from: "2026-1-1",
          to: d,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "/reports/activity", {
          groupId: "FD",
          from: "2026-10-24",
          to: "2026-10-23",
        })
      ).status,
    ).toBe(400);

    const st = await call("POST", "/reports/status", { groupId: "FD" });
    expect(st.status).toBe(200);
    expect((await st.json()).byStatus.unresolved).toBe(1);
    expect(
      (await call("POST", "/reports/status", { groupId: "DX" })).status,
    ).toBe(404);
  });

  it("템플릿 목록·저장·지우기", async () => {
    const saved = await call("POST", "/reports/templates", {
      groupId: "FD",
      name: "주간",
      kind: "activity",
    });
    expect(saved.status).toBe(200);
    const template = await saved.json();
    expect(template).toMatchObject({ params: {}, editable: true });

    expect(
      (
        await call(
          "POST",
          "/reports/templates",
          { groupId: "FD", name: "남의 것", kind: "status" },
          "c",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call("POST", "/reports/templates", {
          groupId: "FD",
          name: "",
          kind: "status",
        })
      ).status,
    ).toBe(400);

    const list = await call(
      "GET",
      "/reports/templates?groupId=FD",
      undefined,
      "c",
    );
    expect((await list.json()).templates).toEqual([
      { ...template, editable: false },
    ]);

    const removed = await call("DELETE", `/reports/templates/${template.id}`);
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");
    expect(
      (await call("DELETE", `/reports/templates/${template.id}`)).status,
    ).toBe(404);
  });
});
