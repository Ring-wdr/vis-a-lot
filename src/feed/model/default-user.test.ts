import { describe, expect, it } from "vitest";
import type { FeedUser } from "../api/types";
import { resolveCurrentUser } from "./default-user";

const user = (id: string, active = true): FeedUser => ({
  id,
  name: id,
  email: null,
  isAdmin: false,
  active,
});

describe("resolveCurrentUser", () => {
  it("저장한 사용자가 활성이면 그대로 쓴다", () => {
    expect(resolveCurrentUser([user("u1"), user("u2")], "u2")).toBe("u2");
  });

  it("저장한 사용자가 없거나 비활성이면 u1을 고른다", () => {
    const users = [user("u2"), user("u1"), user("u3", false)];
    expect(resolveCurrentUser(users, null)).toBe("u1");
    expect(resolveCurrentUser(users, "u3")).toBe("u1");
    expect(resolveCurrentUser(users, "gone")).toBe("u1");
  });

  it("u1이 없거나 비활성이면 첫 활성 사용자를 고른다", () => {
    expect(resolveCurrentUser([user("u1", false), user("u4")], null)).toBe(
      "u4",
    );
    expect(resolveCurrentUser([user("u1", false)], null)).toBeNull();
  });
});
