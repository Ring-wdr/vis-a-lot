import { describe, expect, it } from "vitest";
import { focusTest } from "./focus";

describe("focus", () => {
  it("연산자별 판정 (x 또는 y)", () => {
    const y = (operator: Parameters<typeof focusTest>[0]["operator"]) =>
      focusTest({ target: "y", operator, value: 5 });
    expect(y(">")(0, 6)).toBe(true);
    expect(y(">")(0, 5)).toBe(false);
    expect(y(">=")(0, 5)).toBe(true);
    expect(y("<")(0, 4)).toBe(true);
    expect(y("<=")(0, 5)).toBe(true);
    expect(y("=")(0, 5 + 1e-12)).toBe(true);
    expect(y("!=")(0, 5)).toBe(false);
    expect(focusTest({ target: "x", operator: ">", value: 1 })(2, 0)).toBe(
      true,
    );
  });
});
