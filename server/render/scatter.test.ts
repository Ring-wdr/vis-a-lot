import { describe, expect, it } from "vitest";
import { type ScatterInput, withoutDeleted } from "./scatter";

const input = (deletions: ScatterInput["deletions"]): ScatterInput => ({
  width: 100,
  height: 100,
  title: "t",
  xKind: "number",
  xs: Float64Array.from([1, 2, 3, 4]),
  ys: Float64Array.from([1, 2, 3, 4]),
  ids: Float64Array.from([10, 20, 30, 40]),
  color: "#000000",
  legend: {
    title: "g",
    values: ["a", "b"],
    colors: ["#000000", "#ffffff"],
    index: Uint8Array.from([0, 1, 0, 1]),
  },
  shapes: [],
  deletions,
});

describe("withoutDeleted", () => {
  it("지운 영역 안의 점을 행 id·legend와 함께 뺀다", () => {
    const out = withoutDeleted(
      input([{ type: "rect", x0: 1.5, y0: 1.5, x1: 3.5, y1: 3.5 }]),
    );
    expect([...out.xs]).toEqual([1, 4]);
    expect([...out.ids]).toEqual([10, 40]);
    expect([...(out.legend?.index ?? [])]).toEqual([0, 1]);
  });

  it("지운 영역이 없으면 입력을 그대로 쓴다", () => {
    const original = input(undefined);
    expect(withoutDeleted(original)).toBe(original);
  });
});
