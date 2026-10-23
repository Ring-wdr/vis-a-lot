import { describe, expect, it } from "vitest";
import { createTestFeed, type TestFeed } from "./test-db";

async function setup() {
  const t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "관리자", email: "a@x.io", is_admin: true },
      { id: "u2", name: "멤버", email: null },
      { id: "u3", name: "퇴사자", email: null, active: false },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values({ id: "g1", name: "피드", key_prefix: "FD" })
    .execute();
  return t;
}

async function insertPost(
  t: TestFeed,
  seq: number,
  values: {
    status?: "unresolved" | "in_review" | "resolved";
    assignee_id?: string;
    requester_id?: string;
    deleted?: boolean;
  },
) {
  await t.db
    .insertInto("posts")
    .values({
      id: `p${seq}`,
      key: `FD-${seq}`,
      seq,
      group_id: "g1",
      format: "chart",
      title: `게시물 ${seq}`,
      author_id: "u1",
      status: values.status,
      assignee_id: values.assignee_id ?? null,
      requester_id: values.requester_id ?? null,
      deleted_at: values.deleted ? "2026-10-01T00:00:00Z" : null,
    })
    .execute();
}

describe("users", () => {
  it("list는 사용자 없이도 비활성 사용자까지 id 순으로 돌려준다", async () => {
    const t = await setup();
    const { users } = await t.run("users.list", undefined);
    expect(users.map((u) => u.id)).toEqual(["u1", "u2", "u3"]);
    expect(users[0]).toEqual({
      id: "u1",
      name: "관리자",
      email: "a@x.io",
      isAdmin: true,
      active: true,
    });
    expect(users[2].active).toBe(false);
  });

  it("me는 사용자가 필요하고 관심 목록을 붙인다", async () => {
    const t = await setup();
    await expect(t.run("users.me", undefined)).rejects.toMatchObject({
      status: 401,
    });
    await t.run("users.follow", { userId: "u1", on: true }, { actor: "u2" });
    const me = await t.run("users.me", undefined, { actor: "u2" });
    expect(me).toMatchObject({ id: "u2", isAdmin: false, following: ["u1"] });
  });

  it("follow는 켜고 끄며 자기 자신은 400, 모르는 사용자는 404", async () => {
    const t = await setup();
    const on = { actor: "u2" };
    expect(await t.run("users.follow", { userId: "u1", on: true }, on)).toEqual(
      { following: true },
    );
    // 두 번 켜도 괜찮다
    await t.run("users.follow", { userId: "u1", on: true }, on);
    await t.run("users.follow", { userId: "u1", on: false }, on);
    expect((await t.run("users.me", undefined, on)).following).toEqual([]);
    await expect(
      t.run("users.follow", { userId: "u2", on: true }, on),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run("users.follow", { userId: "nobody", on: true }, on),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("setAdmin은 시스템 관리자만, 마지막 관리자는 스스로 해제할 수 없다", async () => {
    const t = await setup();
    await expect(
      t.run("users.setAdmin", { userId: "u2", on: true }, { actor: "u2" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      t.run("users.setAdmin", { userId: "u1", on: false }, { actor: "u1" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run("users.setAdmin", { userId: "nobody", on: true }, { actor: "u1" }),
    ).rejects.toMatchObject({ status: 404 });

    const u2 = await t.run(
      "users.setAdmin",
      { userId: "u2", on: true },
      { actor: "u1" },
    );
    expect(u2.isAdmin).toBe(true);
    // 다른 관리자가 있으면 스스로 해제할 수 있다
    const u1 = await t.run(
      "users.setAdmin",
      { userId: "u1", on: false },
      { actor: "u1" },
    );
    expect(u1.isAdmin).toBe(false);
  });

  it("deactivate는 담당·요청 중인 열린 게시물을 돌려준다", async () => {
    const t = await setup();
    await insertPost(t, 1, { assignee_id: "u2" });
    await insertPost(t, 2, { status: "in_review", requester_id: "u2" });
    await insertPost(t, 3, { status: "resolved", assignee_id: "u2" });
    await insertPost(t, 4, { assignee_id: "u2", deleted: true });
    await insertPost(t, 5, { assignee_id: "u1" });

    await expect(
      t.run("users.deactivate", { userId: "u1" }, { actor: "u2" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      t.run("users.deactivate", { userId: "u1" }, { actor: "u1" }),
    ).rejects.toMatchObject({ status: 400 });

    const res = await t.run(
      "users.deactivate",
      { userId: "u2" },
      { actor: "u1" },
    );
    expect(res.user).toMatchObject({ id: "u2", active: false });
    expect(res.openPosts).toEqual([
      {
        id: "p1",
        key: "FD-1",
        title: "게시물 1",
        status: "unresolved",
        groupId: "g1",
      },
      {
        id: "p2",
        key: "FD-2",
        title: "게시물 2",
        status: "in_review",
        groupId: "g1",
      },
    ]);
    // 비활성 사용자로는 op를 부를 수 없다
    await expect(
      t.run("users.me", undefined, { actor: "u2" }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
