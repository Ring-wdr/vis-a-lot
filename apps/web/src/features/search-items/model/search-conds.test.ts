import { describe, expect, it } from "vitest";
import {
  addCond,
  MAX_SEARCH_CONDS,
  MAX_SEARCH_KEYWORD,
  removeCond,
} from "./search-conds";

describe("검색 조건", () => {
  it("앞뒤 공백을 빼고 더한다", () => {
    expect(addCond([], "  A1 ", "contains")).toEqual({
      ok: true,
      search: [{ keyword: "A1", match: "contains" }],
    });
  });

  it("빈 글자는 더하지 않는다", () => {
    expect(addCond([], "   ", "contains")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("글자와 방식이 같은 조건은 대소문자를 무시하고 중복이다", () => {
    const search = [{ keyword: "Seoul", match: "contains" as const }];
    expect(addCond(search, "SEOUL", "contains")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    // 방식이 다르면 다른 조건이다.
    expect(addCond(search, "seoul", "startsWith").ok).toBe(true);
  });

  it("조건 수와 글자 수의 한도", () => {
    const full = Array.from({ length: MAX_SEARCH_CONDS }, (_, i) => ({
      keyword: `k${i}`,
      match: "contains" as const,
    }));
    expect(addCond(full, "new", "contains")).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(addCond([], "a".repeat(MAX_SEARCH_KEYWORD + 1), "exact")).toEqual({
      ok: false,
      reason: "tooLong",
    });
  });

  it("순번으로 지운다", () => {
    const search = [
      { keyword: "a", match: "contains" as const },
      { keyword: "b", match: "exact" as const },
    ];
    expect(removeCond(search, 0)).toEqual([{ keyword: "b", match: "exact" }]);
  });
});
