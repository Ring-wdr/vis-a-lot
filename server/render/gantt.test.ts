import { describe, expect, it } from "vitest";
import { barPoint, ganttExtent, mergeIntoPixels, rowY } from "./gantt";

const bars = {
  r: [0, 0, 1],
  s: [0, 100, 50],
  e: [100, 300, 60],
  g: [0, 1, 0],
  n: [1, 1, 1],
};

describe("gantt", () => {
  it("첫 행이 맨 위에 오도록 행 y를 뒤집는다", () => {
    expect(rowY(3, 0)).toBe(2);
    expect(rowY(3, 2)).toBe(0);
    expect(barPoint(bars, 2, 2)).toEqual([55, 0]);
  });

  it("전체 범위는 처음 시작~마지막 끝, 모든 행", () => {
    expect(ganttExtent(bars, 2)).toEqual({ x: [0, 300], y: [-0.5, 1.5] });
  });

  it("같은 픽셀 칸 안에서 시작하고 끝나는 짧은 구간은 앞 막대에 합친다", () => {
    // 행 0: [0, 2.5] [2.6, 2.9] [2.95, 3.4] [3.5, 9]
    const owner = mergeIntoPixels(
      [0, 0, 0, 0, 1],
      [0, 2.6, 2.95, 3.5, 2.7],
      [2.5, 2.9, 3.4, 9, 2.8],
      () => true,
    );
    // 두 번째는 첫 막대가 차지한 칸 2 안이라 합치고, 세 번째는 칸 3으로 넘어가 새로 그린다.
    // 네 번째는 칸 3에서 시작하지만 9까지 가므로 그린다. 다른 행은 따로 센다.
    expect([...owner]).toEqual([0, 0, 2, 3, 4]);
  });

  it("그리지 않는 막대(숨김, 범위 밖)는 건너뛴다", () => {
    const owner = mergeIntoPixels([0, 0], [0, 0.5], [0.4, 0.8], (j) => j !== 0);
    expect([...owner]).toEqual([-1, 1]);
  });
});
