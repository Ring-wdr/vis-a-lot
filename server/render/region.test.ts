import { describe, expect, it } from "vitest";
import { type Region, regionContains, regionTester } from "./region";

describe("regionContains", () => {
  it("사각형은 방향과 상관없이 경계를 포함한다", () => {
    const rect = { type: "rect", x0: 10, y0: 5, x1: 0, y1: 0 } as const;
    expect(regionContains(rect, 0, 0)).toBe(true);
    expect(regionContains(rect, 5, 2)).toBe(true);
    expect(regionContains(rect, 11, 2)).toBe(false);
  });

  it("자유형은 닫힌 다각형으로 본다", () => {
    // ㄱ자 모양: 오목한 부분은 바깥이다.
    const region: Region = {
      type: "lasso",
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 10],
        [5, 5],
        [0, 5],
      ],
    };
    expect(regionContains(region, 2, 2)).toBe(true);
    expect(regionContains(region, 7, 8)).toBe(true);
    expect(regionContains(region, 2, 8)).toBe(false);
    expect(regionTester(region)(2, 8)).toBe(false);
    expect(regionTester(region)(20, 2)).toBe(false);
  });
});
