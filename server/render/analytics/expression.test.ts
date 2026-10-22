import { describe, expect, it } from "vitest";
import { compileExpression } from "./expression";

const run = (src: string, x = 0, y = 0) => {
  const c = compileExpression(src);
  if (!c.ok) throw new Error(c.error);
  return c.fn(x, y);
};

describe("expression", () => {
  it("우선순위·결합 방향", () => {
    expect(run("1 + 2 * 3")).toBe(7);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("2 ^ 3 ^ 2")).toBe(512);
    expect(run("-2 ^ 2")).toBe(-4);
    expect(run("2 ^ -1")).toBe(0.5);
    expect(run("10 - 4 - 3")).toBe(3);
    expect(run("8 / 4 / 2")).toBe(1);
    expect(run("1.5e2 + .5")).toBe(150.5);
  });

  it("변수와 함수", () => {
    expect(run("x * 2 + y", 3, 1)).toBe(7);
    expect(run("log(100) + ln(exp(1))")).toBeCloseTo(3);
    expect(run("max(x, y) - min(x, y)", 2, 5)).toBe(3);
    expect(run("pow(2, 10) + sqrt(16) + abs(-1)")).toBe(1029);
    expect(run("round(2.5) + floor(1.9) + ceil(1.1)")).toBe(6);
    expect(run("X + Y", 1, 2)).toBe(3);
  });

  it("유한하지 않은 결과는 NaN", () => {
    expect(run("1 / x", 0)).toBeNaN();
    expect(run("log(x)", -1)).toBeNaN();
  });

  it("잘못된 식은 오류 글자", () => {
    for (const src of [
      "",
      "1 +",
      "(1",
      "foo(1)",
      "min(1)",
      "1 $ 2",
      "1 2",
      "x(1)",
    ]) {
      const c = compileExpression(src);
      expect(c.ok, src).toBe(false);
    }
    const c = compileExpression("abs(1, 2)");
    expect(c.ok ? "" : c.error).toContain("인자 1개");
  });
});
