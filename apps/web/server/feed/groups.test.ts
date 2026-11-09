import { describe, expect, it } from "vitest";
import { createTestFeed } from "./test-db";

// u1 시스템 관리자, u2 FD 관리자, u3 FD·DX 멤버, u4 어디에도 없음. DX는 비공개
async function setup() {
  const t = await createTestFeed();
  await t.db
    .insertInto("users")
    .values([
      { id: "u1", name: "시스템", email: null, is_admin: true },
      { id: "u2", name: "그룹장", email: null },
      { id: "u3", name: "멤버", email: null },
      { id: "u4", name: "외부", email: null },
    ])
    .execute();
  await t.db
    .insertInto("groups")
    .values([
      {
        id: "g1",
        name: "피드",
        key_prefix: "FD",
        status_names: JSON.stringify({ in_review: "승인 대기" }),
      },
      { id: "g2", name: "데이터", key_prefix: "DX", is_private: true },
    ])
    .execute();
  await t.db
    .insertInto("group_members")
    .values([
      { group_id: "g1", user_id: "u3", role: "member" },
      { group_id: "g1", user_id: "u2", role: "admin" },
      { group_id: "g2", user_id: "u3", role: "member" },
      { group_id: "g2", user_id: "u2", role: "admin" },
    ])
    .execute();
  return t;
}

describe("groups", () => {
  it("list는 사용자가 필요하다", async () => {
    const t = await setup();
    await expect(t.run("groups.list", undefined)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("비공개 그룹은 멤버와 시스템 관리자만 본다", async () => {
    const t = await setup();
    const ids = async (actor: string) =>
      (await t.run("groups.list", undefined, { actor })).groups.map(
        (g) => g.keyPrefix,
      );
    // 공개 그룹 먼저
    expect(await ids("u3")).toEqual(["FD", "DX"]);
    expect(await ids("u4")).toEqual(["FD"]);
    expect(await ids("u1")).toEqual(["FD", "DX"]);

    await expect(
      t.run("groups.get", { groupId: "DX" }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 404 });
    const dx = await t.run("groups.get", { groupId: "DX" }, { actor: "u1" });
    expect(dx.myRole).toBe("admin");
  });

  it("list는 내 역할·멤버 수·상태 이름을 붙인다", async () => {
    const t = await setup();
    const { groups } = await t.run("groups.list", undefined, { actor: "u3" });
    expect(groups.find((g) => g.id === "g1")).toEqual({
      id: "g1",
      name: "피드",
      keyPrefix: "FD",
      description: null,
      isPrivate: false,
      statusNames: { in_review: "승인 대기" },
      myRole: "member",
      memberCount: 2,
    });
    const u4 = await t.run("groups.list", undefined, { actor: "u4" });
    expect(u4.groups[0].myRole).toBeNull();
  });

  it("get은 id나 키 접두사로 찾고 멤버는 관리자 먼저", async () => {
    const t = await setup();
    const fd = await t.run("groups.get", { groupId: "FD" }, { actor: "u4" });
    expect(fd.id).toBe("g1");
    expect(fd.members).toEqual([
      { userId: "u2", role: "admin" },
      { userId: "u3", role: "member" },
    ]);
    const byId = await t.run("groups.get", { groupId: "g1" }, { actor: "u4" });
    expect(byId.keyPrefix).toBe("FD");
  });

  it("바꾸는 op는 그룹 관리자만", async () => {
    const t = await setup();
    await expect(
      t.run(
        "groups.update",
        { groupId: "FD", patch: { name: "x" } },
        { actor: "u3" },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      t.run("groups.saveTeam", { groupId: "FD", name: "x" }, { actor: "u4" }),
    ).rejects.toMatchObject({ status: 403 });
    // 시스템 관리자는 멤버가 아니어도 된다
    const fd = await t.run(
      "groups.update",
      { groupId: "FD", patch: { name: "피드2", isPrivate: true } },
      { actor: "u1" },
    );
    expect(fd).toMatchObject({ name: "피드2", isPrivate: true });
  });

  it("키 접두사는 겹치면 400, 바꿔도 기존 게시물 키는 그대로", async () => {
    const t = await setup();
    await t.db
      .insertInto("posts")
      .values({
        id: "p1",
        key: "FD-1",
        seq: 1,
        group_id: "g1",
        format: "code",
        title: "글",
        author_id: "u2",
      })
      .execute();
    await expect(
      t.run(
        "groups.update",
        { groupId: "FD", patch: { keyPrefix: "DX" } },
        { actor: "u2" },
      ),
    ).rejects.toMatchObject({ status: 400 });
    const fd = await t.run(
      "groups.update",
      {
        groupId: "FD",
        patch: { keyPrefix: "FE", statusNames: { on_hold: "대기" } },
      },
      { actor: "u2" },
    );
    expect(fd).toMatchObject({
      keyPrefix: "FE",
      statusNames: { on_hold: "대기" },
    });
    const post = await t.db
      .selectFrom("posts")
      .select("key")
      .executeTakeFirstOrThrow();
    expect(post.key).toBe("FD-1");
  });

  it("멤버 추가·역할 변경, 마지막 그룹 관리자는 빼거나 내릴 수 없다", async () => {
    const t = await setup();
    const a = { actor: "u2" };
    await expect(
      t.run("groups.removeMember", { groupId: "FD", userId: "u2" }, a),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run(
        "groups.setMember",
        { groupId: "FD", userId: "u2", role: "member" },
        a,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      t.run(
        "groups.setMember",
        { groupId: "FD", userId: "nobody", role: "member" },
        a,
      ),
    ).rejects.toMatchObject({ status: 404 });

    let fd = await t.run(
      "groups.setMember",
      { groupId: "FD", userId: "u4", role: "admin" },
      a,
    );
    expect(fd.members.map((m) => m.userId)).toEqual(["u2", "u4", "u3"]);
    expect(fd.memberCount).toBe(3);
    fd = await t.run("groups.removeMember", { groupId: "FD", userId: "u2" }, a);
    expect(fd.members).toEqual([
      { userId: "u4", role: "admin" },
      { userId: "u3", role: "member" },
    ]);
  });

  it("팀 만들기·이름 바꾸기·지우기, 다른 그룹 팀은 404", async () => {
    const t = await setup();
    const a = { actor: "u2" };
    let fd = await t.run(
      "groups.saveTeam",
      { groupId: "FD", name: "백엔드" },
      a,
    );
    fd = await t.run("groups.saveTeam", { groupId: "FD", name: "프론트" }, a);
    expect(fd.teams.map((x) => x.name)).toEqual(["백엔드", "프론트"]);
    const team = fd.teams[0];
    expect(team.id).toMatch(/^t_/);

    fd = await t.run(
      "groups.saveTeam",
      { groupId: "FD", id: team.id, name: "플랫폼" },
      a,
    );
    expect(fd.teams.map((x) => x.name)).toEqual(["프론트", "플랫폼"]);
    await expect(
      t.run("groups.saveTeam", { groupId: "DX", id: team.id, name: "x" }, a),
    ).rejects.toMatchObject({ status: 404 });

    await t.db
      .insertInto("posts")
      .values({
        id: "p1",
        key: "FD-1",
        seq: 1,
        group_id: "g1",
        team_id: team.id,
        format: "code",
        title: "글",
        author_id: "u2",
      })
      .execute();
    fd = await t.run(
      "groups.deleteTeam",
      { groupId: "FD", teamId: team.id },
      a,
    );
    expect(fd.teams.map((x) => x.name)).toEqual(["프론트"]);
    const post = await t.db
      .selectFrom("posts")
      .select("team_id")
      .executeTakeFirstOrThrow();
    expect(post.team_id).toBeNull();
  });

  it("게시물 유형: sort를 안 주면 맨 뒤, 지우면 게시물은 유형 없음", async () => {
    const t = await setup();
    const a = { actor: "u2" };
    let fd = await t.run(
      "groups.savePostType",
      { groupId: "FD", name: "버그", color: "#ff0000" },
      a,
    );
    fd = await t.run(
      "groups.savePostType",
      { groupId: "FD", name: "기능", color: null },
      a,
    );
    expect(fd.postTypes.map((p) => [p.name, p.sort])).toEqual([
      ["버그", 0],
      ["기능", 1],
    ]);
    const bug = fd.postTypes[0];
    expect(bug.id).toMatch(/^pt_/);

    fd = await t.run(
      "groups.savePostType",
      { groupId: "FD", id: bug.id, name: "결함", color: "#00ff00", sort: 5 },
      a,
    );
    expect(fd.postTypes.map((p) => p.name)).toEqual(["기능", "결함"]);
    await expect(
      t.run(
        "groups.savePostType",
        { groupId: "DX", id: bug.id, name: "x", color: null },
        a,
      ),
    ).rejects.toMatchObject({ status: 404 });

    await t.db
      .insertInto("posts")
      .values({
        id: "p1",
        key: "FD-1",
        seq: 1,
        group_id: "g1",
        post_type_id: bug.id,
        format: "code",
        title: "글",
        author_id: "u2",
      })
      .execute();
    fd = await t.run(
      "groups.deletePostType",
      { groupId: "FD", postTypeId: bug.id },
      a,
    );
    expect(fd.postTypes.map((p) => p.name)).toEqual(["기능"]);
    const post = await t.db
      .selectFrom("posts")
      .select("post_type_id")
      .executeTakeFirstOrThrow();
    expect(post.post_type_id).toBeNull();
  });
});
