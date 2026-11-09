import { describe, expect, it } from "vitest";
import type { AxisMeta } from "@/shared/api/types";
import { invertAxis } from "./coords";

describe("invertAxis", () => {
  const x: AxisMeta = { kind: "number", domain: [0, 100] };
  const y: AxisMeta = { kind: "number", domain: [0, 50] };

  it("x는 왼쪽에서 오른쪽으로, y는 아래에서 위로 값을 늘린다", () => {
    expect(invertAxis(x, 40, 200, 140, false)).toBe(50);
    expect(invertAxis(y, 20, 100, 20, true)).toBe(50);
    expect(invertAxis(y, 20, 100, 120, true)).toBe(0);
  });
});

describe("invertAxis 로그 축", () => {
  it("log10 공간에서 보간한다", () => {
    const axis = {
      kind: "number" as const,
      domain: [1, 1000] as [number, number],
      log: true,
    };
    expect(invertAxis(axis, 0, 300, 100, false)).toBeCloseTo(10);
    expect(invertAxis({ ...axis, log: false }, 0, 300, 150, false)).toBeCloseTo(
      500.5,
    );
  });
});
