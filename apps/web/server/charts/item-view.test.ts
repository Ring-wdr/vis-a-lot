import { describe, expect, it } from "vitest";
import { pan, zoomIn, zoomOut } from "./item-view";

describe("zoomIn", () => {
  it("드래그 방향과 상관없이 범위를 정렬한다", () => {
    expect(zoomIn([10, 2], [8, 3])).toEqual({ x: [2, 10], y: [3, 8] });
  });

  it("넓이가 없는 영역은 무시한다", () => {
    expect(zoomIn([5, 5], [1, 2])).toBeUndefined();
  });
});

describe("zoomOut", () => {
  const full = {
    x: [0, 100] as [number, number],
    y: [0, 10] as [number, number],
  };

  it("현재 범위를 가운데 기준으로 ratio배 넓힌다", () => {
    expect(zoomOut({ x: [40, 60], y: [4, 6] }, full, 2)).toEqual({
      x: [30, 70],
      y: [3, 7],
    });
  });

  it("전체 범위를 모두 덮으면 확대를 해제한다", () => {
    expect(zoomOut({ x: [20, 80], y: [2, 8] }, full, 2)).toBeUndefined();
  });
});

describe("pan", () => {
  it("범위를 데이터 값만큼 옮긴다", () => {
    expect(pan({ x: [0, 10], y: [5, 6] }, 3, -1)).toEqual({
      x: [3, 13],
      y: [4, 5],
    });
  });

  it("움직이지 않았으면 무시한다", () => {
    expect(pan({ x: [0, 10], y: [5, 6] }, 0, 0)).toBeUndefined();
  });
});
