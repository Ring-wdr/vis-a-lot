import { describe, expect, it } from "vitest";
import { axisAngle, radarDomain, vertexOf } from "./radar";

describe("radar", () => {
  it("첫 축은 12시, 나머지는 시계 방향으로 똑같이 나눈다", () => {
    expect(axisAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
    expect(axisAngle(1, 4)).toBeCloseTo(0);
    const [x, y] = vertexOf({ x: 50, y: 50 }, 10, 1, 4);
    expect(x).toBeCloseTo(60);
    expect(y).toBeCloseTo(50);
  });

  it("값 범위는 0을 포함하고, 음수가 있으면 최솟값부터", () => {
    expect(
      radarDomain([
        [3, 7],
        [null, 9.2],
      ]).domain(),
    ).toEqual([0, 10]);
    expect(radarDomain([[-4, 8]]).domain()[0]).toBeLessThanOrEqual(-4);
    expect(radarDomain([[null]]).domain()).toEqual([0, 1]);
  });
});
