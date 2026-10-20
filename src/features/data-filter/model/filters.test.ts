import { describe, expect, it } from "vitest";
import { rangeFilter, sameFilters, withFilter } from "./filters";

const summary = {
  kind: "range" as const,
  column: "value" as const,
  type: "number" as const,
  min: 0,
  max: 100,
  nullCount: 3,
  count: 10,
};

describe("rangeFilter", () => {
  it("전체 범위 그대로면 필터를 두지 않는다", () => {
    expect(rangeFilter(summary, [0, 100], false, true)).toBeUndefined();
  });

  it("범위를 줄이거나 반전·null 제외면 필터가 된다", () => {
    expect(rangeFilter(summary, [10, 100], false, true)).toMatchObject({
      min: 10,
    });
    expect(rangeFilter(summary, [0, 100], true, true)).toMatchObject({
      inverse: true,
    });
    expect(rangeFilter(summary, [0, 100], false, false)).toMatchObject({
      includeNull: false,
    });
  });
});

describe("withFilter / sameFilters", () => {
  it("컬럼마다 하나만 두고, undefined면 지운다", () => {
    const a = withFilter([], "factory", {
      kind: "exclude",
      column: "factory",
      values: ["구미"],
    });
    const b = withFilter(a, "factory", {
      kind: "exclude",
      column: "factory",
      values: ["울산"],
    });
    expect(b).toHaveLength(1);
    expect(withFilter(b, "factory", undefined)).toEqual([]);
  });

  it("순서와 값 순서가 달라도 같은 조건이면 같다", () => {
    expect(
      sameFilters(
        [{ kind: "exclude", column: "factory", values: ["a", "b"] }],
        [{ kind: "exclude", column: "factory", values: ["b", "a"] }],
      ),
    ).toBe(true);
    expect(sameFilters(undefined, [])).toBe(true);
  });
});
