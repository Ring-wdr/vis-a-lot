import { describe, expect, it } from "vitest";
import { createTestFeed } from "./test-db";

describe("피드 스키마", () => {
  it("빈 스키마를 만들고 system.status가 0을 돌려준다", async () => {
    const t = await createTestFeed();
    expect(await t.run("system.status", undefined)).toEqual({
      users: 0,
      posts: 0,
    });
  });

  it("모르는 사용자는 401", async () => {
    const t = await createTestFeed();
    await expect(
      t.run("system.status", undefined, { actor: "nobody" }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
