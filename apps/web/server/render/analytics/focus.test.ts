import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../options";
import { type FocusRule, focusMatcher, rankBound } from "./focus";

const rule = (patch: Partial<FocusRule>): FocusRule => ({
  ...DEFAULT_OPTIONS.focus,
  ...patch,
});
const none = new Float64Array(0);

describe("focus", () => {
  it("조건: 연산자별 판정 (x 또는 y)", () => {
    const y = (operator: FocusRule["operator"]) =>
      focusMatcher(rule({ target: "y", operator, value: 5 }), none, none);
    expect(y(">")(0, 6)).toBe(true);
    expect(y(">")(0, 5)).toBe(false);
    expect(y(">=")(0, 5)).toBe(true);
    expect(y("<")(0, 4)).toBe(true);
    expect(y("<=")(0, 5)).toBe(true);
    expect(y("=")(0, 5 + 1e-12)).toBe(true);
    expect(y("!=")(0, 5)).toBe(false);
    const x = focusMatcher(
      rule({ target: "x", operator: ">", value: 1 }),
      none,
      none,
    );
    expect(x(2, 0)).toBe(true);
  });

  it("기본 방식은 조건이다", () => {
    expect(DEFAULT_OPTIONS.focus.type).toBe("condition");
  });

  it("순위: 위 N개 (경계 값과 같은 것은 모두)", () => {
    const ys = [1, 9, 3, 7, 7, 2, 5];
    const top = focusMatcher(
      rule({ type: "rank", target: "y", rankFrom: "top", rankCount: 3 }),
      [],
      ys,
    );
    // 9, 7, 7이 위 셋이고 경계는 7
    expect(ys.filter((v) => top(0, v))).toEqual([9, 7, 7]);
    const top2 = focusMatcher(
      rule({ type: "rank", target: "y", rankFrom: "top", rankCount: 2 }),
      [],
      ys,
    );
    // 둘째가 7이고 7이 둘이라 셋이 된다.
    expect(ys.filter((v) => top2(0, v))).toEqual([9, 7, 7]);
  });

  it("순위: 아래 N개, x 대상", () => {
    const xs = [4, 1, 8, 1, 6];
    const bottom = focusMatcher(
      rule({ type: "rank", target: "x", rankFrom: "bottom", rankCount: 2 }),
      xs,
      [],
    );
    expect(xs.filter((v) => bottom(v, 0))).toEqual([1, 1]);
    const bottom3 = focusMatcher(
      rule({ type: "rank", target: "x", rankFrom: "bottom", rankCount: 3 }),
      xs,
      [],
    );
    expect(xs.filter((v) => bottom3(v, 0))).toEqual([4, 1, 1]);
  });

  it("순위: 개수가 값보다 많으면 모두, 값이 없으면 아무것도", () => {
    const all = focusMatcher(
      rule({ type: "rank", target: "y", rankCount: 10 }),
      [],
      [3, 1, 2],
    );
    expect([3, 1, 2].every((v) => all(0, v))).toBe(true);
    const empty = focusMatcher(rule({ type: "rank", target: "y" }), [], []);
    expect(empty(0, 1)).toBe(false);
  });

  it("순위: include로 뺀 자리와 NaN은 세지 않는다", () => {
    const ys = [10, 9, Number.NaN, 8, 7];
    // 10을 빼면 위 둘은 9, 8
    expect(rankBound(ys, 2, "top", (i) => i !== 0)).toBe(8);
    expect(rankBound(ys, 2, "top")).toBe(9);
    expect(rankBound([], 2, "top")).toBeUndefined();
  });

  it("순위: 많은 값에서도 정렬과 같은 경계", () => {
    const values = Array.from({ length: 5000 }, (_, i) => (i * 7919) % 1013);
    const sorted = [...values].sort((a, b) => b - a);
    expect(rankBound(values, 100, "top")).toBe(sorted[99]);
    expect(rankBound(values, 100, "bottom")).toBe(sorted[sorted.length - 100]);
  });

  it("범위: 양 끝 포함, 한쪽 열림", () => {
    const both = focusMatcher(
      rule({ type: "range", target: "y", rangeMin: 2, rangeMax: 4 }),
      none,
      none,
    );
    expect([1, 2, 3, 4, 5].filter((v) => both(0, v))).toEqual([2, 3, 4]);
    const openMax = focusMatcher(
      rule({ type: "range", target: "y", rangeMin: 3, rangeMax: null }),
      none,
      none,
    );
    expect([1, 3, 1e9].filter((v) => openMax(0, v))).toEqual([3, 1e9]);
    const openMin = focusMatcher(
      rule({ type: "range", target: "x", rangeMin: null, rangeMax: 0 }),
      none,
      none,
    );
    expect([-5, 0, 1].filter((v) => openMin(v, 0))).toEqual([-5, 0]);
  });

  it("범위: 뒤집힌 범위는 맞는 것이 없다", () => {
    const flipped = focusMatcher(
      rule({ type: "range", target: "y", rangeMin: 5, rangeMax: 1 }),
      none,
      none,
    );
    expect([0, 1, 3, 5, 6].some((v) => flipped(0, v))).toBe(false);
  });
});
