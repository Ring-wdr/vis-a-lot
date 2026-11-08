import { describe, expect, it } from "vitest";
import { colorDomainOf, SEQUENTIAL_RAMP, sequentialColor } from "./heatmap";

describe("heatmap 색 척도", () => {
  it("빈 칸을 빼고 값 범위를 잡는다", () => {
    expect(
      colorDomainOf([
        [1, null],
        [null, 5],
      ]),
    ).toEqual([1, 5]);
    expect(colorDomainOf([[3]])).toEqual([2, 4]);
    expect(colorDomainOf([])).toEqual([0, 1]);
  });

  it("작은 값은 옅은 끝, 큰 값은 짙은 끝 색이다", () => {
    const color = sequentialColor([0, 10]);
    expect(color(0)).toBe("rgb(205, 226, 251)");
    expect(color(10)).toBe("rgb(13, 54, 107)");
    // 범위 밖은 끝 색으로 붙잡는다.
    expect(color(20)).toBe(color(10));
    expect(SEQUENTIAL_RAMP).toHaveLength(7);
  });
});
