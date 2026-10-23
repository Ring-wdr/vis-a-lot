import { describe, expect, it } from "vitest";
import { createTestFeed } from "./test-db";

// u1 시스템 관리자, u2 FD·DX 관리자, u3 FD·DX 멤버, u4 FD 멤버. DX는 비공개
async function setup() {
  const t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "시스템", is_admin: true },
      { id: "u2", name: "그룹장" },
      { id: "u3", name: "멤버" },
      { id: "u4", name: "외부" },
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
      { group_id: "g1", user_id: "u2", role: "admin" },
      { group_id: "g1", user_id: "u3", role: "member" },
      { group_id: "g1", user_id: "u4", role: "member" },
      { group_id: "g2", user_id: "u2", role: "admin" },
      { group_id: "g2", user_id: "u3", role: "member" },
    ])
    .execute();
  const view = (
    id: string,
    owner: string,
    group: string | null,
    name: string,
    shared: boolean,
    pinned = false,
  ) => ({
    id,
    owner_id: owner,
    group_id: group,
    name,
    shared,
    layout: "list" as const,
    filter: JSON.stringify(group ? { groupIds: [group] } : {}),
    sort: JSON.stringify({ field: "dueDate", dir: "asc" }),
    group_by: null,
    pinned,
  });
  await t.db
    .insertInto("saved_views")
    .values([
      view("v_fd", "u2", "g1", "FD 공유", true, true),
      view("v_dx", "u2", "g2", "DX 공유", true, true),
      view("v_u3", "u3", null, "내 뷰", false),
      view("v_u3_fd", "u3", "g1", "FD 내 뷰", false, true),
      view("v_u2_private", "u2", "g1", "그룹장 개인", false),
    ])
    .execute();
  return t;
}

const ids = (r: { views: { id: string }[] }) => r.views.map((v) => v.id);

describe("views", () => {
  it("기본 제공 뷰가 맨 앞, 이어서 고정한 것·이름순", async () => {
    const t = await setup();
    const r = await t.run("views.list", {}, { actor: "u3" });
    expect(ids(r)).toEqual([
      "builtin-explore",
      "builtin-following",
      "v_dx",
      "v_fd",
      "v_u3_fd",
      "v_u3",
    ]);
    expect(r.views[0]).toMatchObject({
      name: "탐색",
      layout: "feed",
      filter: {},
      sort: { field: "updatedAt", dir: "desc" },
      pinned: true,
      builtin: true,
      editable: false,
      ownerId: null,
    });
    expect(r.views[1]).toMatchObject({
      name: "관심",
      filter: { followedAuthors: true },
    });
    expect(r.views.find((v) => v.id === "v_u3_fd")).toMatchObject({
      groupId: "g1",
      shared: false,
      layout: "list",
      filter: { groupIds: ["g1"] },
      sort: { field: "dueDate", dir: "asc" },
      builtin: false,
    });
  });

  it("비공개 그룹의 공유 뷰는 멤버가 아니면 안 보인다", async () => {
    const t = await setup();
    const r = await t.run("views.list", {}, { actor: "u4" });
    expect(ids(r)).toEqual(["builtin-explore", "builtin-following", "v_fd"]);
    await expect(
      t.run("views.get", { viewId: "v_dx" }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 404 });
    // 남의 개인 뷰도 안 보인다
    await expect(
      t.run("views.get", { viewId: "v_u2_private" }, { actor: "u3" }),
    ).rejects.toMatchObject({ status: 404 });
    // 시스템 관리자는 비공개 그룹도 본다
    expect(ids(await t.run("views.list", {}, { actor: "u1" }))).toContain(
      "v_dx",
    );
  });

  it("groupId가 있으면 그 그룹 것과 그룹 없는 내 뷰만", async () => {
    const t = await setup();
    const r = await t.run("views.list", { groupId: "FD" }, { actor: "u3" });
    expect(ids(r)).toEqual([
      "builtin-explore",
      "builtin-following",
      "v_fd",
      "v_u3_fd",
      "v_u3",
    ]);
    await expect(
      t.run("views.list", { groupId: "DX" }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("editable: 내 뷰, 또는 그룹 관리자의 공유 뷰", async () => {
    const t = await setup();
    const editable = async (actor: string) =>
      Object.fromEntries(
        (await t.run("views.list", {}, { actor })).views.map((v) => [
          v.id,
          v.editable,
        ]),
      );
    expect(await editable("u3")).toMatchObject({
      v_fd: false,
      v_dx: false,
      v_u3: true,
    });
    expect(await editable("u2")).toMatchObject({ v_fd: true, v_dx: true });
    expect(await editable("u1")).toMatchObject({ v_fd: true, v_dx: true });
  });

  it("get은 기본 제공 뷰도 준다", async () => {
    const t = await setup();
    expect(
      await t.run(
        "views.get",
        { viewId: "builtin-following" },
        { actor: "u4" },
      ),
    ).toMatchObject({ builtin: true, name: "관심" });
    await expect(
      t.run("views.get", { viewId: "nope" }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("만들기·고치기·고정·지우기", async () => {
    const t = await setup();
    const created = await t.run(
      "views.save",
      {
        name: "내 FD",
        layout: "board",
        groupId: "FD",
        filter: { statuses: ["in_review"] },
        groupBy: "assignee",
      },
      { actor: "u4" },
    );
    expect(created).toMatchObject({
      ownerId: "u4",
      groupId: "g1",
      shared: false,
      pinned: false,
      sort: null,
      groupBy: "assignee",
      editable: true,
    });
    expect(created.id).toMatch(/^v_/);

    const updated = await t.run(
      "views.save",
      { id: created.id, name: "바꾼 이름", layout: "list", groupId: null },
      { actor: "u4" },
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: "바꾼 이름",
      layout: "list",
      groupId: null,
      filter: {},
      groupBy: null,
    });

    const pinned = await t.run(
      "views.pin",
      { viewId: created.id, on: true },
      { actor: "u4" },
    );
    expect(pinned.pinned).toBe(true);
    expect(
      (await t.run("views.get", { viewId: created.id }, { actor: "u4" }))
        .pinned,
    ).toBe(true);

    await t.run("views.delete", { viewId: created.id }, { actor: "u4" });
    await expect(
      t.run("views.get", { viewId: created.id }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("공유 뷰: 그룹 필요(400), 멤버만(403), 그룹 관리자가 고친다", async () => {
    const t = await setup();
    await expect(
      t.run(
        "views.save",
        { name: "공유", layout: "feed", shared: true },
        { actor: "u3" },
      ),
    ).rejects.toMatchObject({ status: 400 });
    // u4는 DX를 볼 수 없어 404, FD에서 만든 건 멤버라 된다
    await expect(
      t.run(
        "views.save",
        { name: "공유", layout: "feed", shared: true, groupId: "DX" },
        { actor: "u4" },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      t.run(
        "views.save",
        { name: "없는 그룹", layout: "feed", groupId: "ZZ" },
        { actor: "u3" },
      ),
    ).rejects.toMatchObject({ status: 404 });

    const shared = await t.run(
      "views.save",
      { name: "FD 공유 2", layout: "feed", shared: true, groupId: "g1" },
      { actor: "u4" },
    );
    expect(shared).toMatchObject({ shared: true, groupId: "g1" });
    // 다른 멤버는 보지만 못 고친다, 그룹 관리자는 고친다
    const seen = await t.run(
      "views.get",
      { viewId: shared.id },
      { actor: "u3" },
    );
    expect(seen.editable).toBe(false);
    await expect(
      t.run("views.pin", { viewId: shared.id, on: true }, { actor: "u3" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      t.run(
        "views.save",
        { id: shared.id, name: "덮어쓰기", layout: "feed" },
        { actor: "u3" },
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await t.run(
          "views.pin",
          { viewId: shared.id, on: true },
          { actor: "u2" },
        )
      ).pinned,
    ).toBe(true);
    await t.run("views.delete", { viewId: shared.id }, { actor: "u2" });
  });

  it("기본 제공 뷰는 고치거나 지우거나 고정을 바꿀 수 없다", async () => {
    const t = await setup();
    for (const run of [
      () =>
        t.run(
          "views.save",
          { id: "builtin-explore", name: "x", layout: "feed" },
          { actor: "u1" },
        ),
      () =>
        t.run("views.delete", { viewId: "builtin-explore" }, { actor: "u1" }),
      () =>
        t.run(
          "views.pin",
          { viewId: "builtin-following", on: false },
          { actor: "u1" },
        ),
    ])
      await expect(run()).rejects.toMatchObject({ status: 403 });
  });

  it("남의 뷰를 지우면 403, 사용자 없으면 401", async () => {
    const t = await setup();
    await expect(
      t.run("views.delete", { viewId: "v_fd" }, { actor: "u3" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(t.run("views.list", {})).rejects.toMatchObject({
      status: 401,
    });
  });

  it("기본 시나리오: u1은 FD·DX 공유 뷰와 개인 뷰, u4는 DX 뷰가 없다", async () => {
    const t = await createTestFeed();
    await t.run("seed.load", { scenario: "default" });
    const u1 = ids(await t.run("views.list", {}, { actor: "u1" }));
    expect(u1).toEqual(
      expect.arrayContaining([
        "v_fd_due",
        "v_fd_review",
        "v_dx_due",
        "v_dx_review",
        "v_u1_requested",
      ]),
    );
    const u4 = ids(await t.run("views.list", {}, { actor: "u4" }));
    expect(u4).toEqual(expect.arrayContaining(["v_fd_due", "v_fd_review"]));
    expect(u4).not.toContain("v_dx_due");
    expect(u4).not.toContain("v_u1_requested");
  });
});
