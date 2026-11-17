import { describe, expect, it } from "vitest";
import { POINT_SHAPES } from "../model/chart-options";
import { pointShapePath } from "./point-shape";

/** path의 M·L 꼭짓점 */
const vertices = (d: string) =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);

describe("pointShapePath", () => {
  it("모든 모양의 path를 만든다", () => {
    for (const shape of POINT_SHAPES) {
      expect(pointShapePath(shape, 4), shape).toMatch(/^M/);
    }
  });

  it("새 모양의 꼭짓점 수와 뾰족한 쪽 (PNG 점과 같다)", () => {
    expect(vertices(pointShapePath("downTriangle", 1))[0]).toEqual([0, 1]);
    expect(vertices(pointShapePath("leftTriangle", 1))[0]).toEqual([-1, 0]);
    expect(vertices(pointShapePath("rightTriangle", 1))[0]).toEqual([1, 0]);
    expect(vertices(pointShapePath("hexagon", 2))).toHaveLength(6);
    const star = vertices(pointShapePath("star", 10));
    expect(star).toHaveLength(10);
    expect(star[0]).toEqual([0, -10]);
    expect(Math.hypot(star[1][0], star[1][1])).toBeCloseTo(4.5, 2);
  });
});
