import { describe, expect, it } from "vitest";
import { layoutPie, sliceCentroid } from "./pie";

const slices = [
  { category: "a", value: 3 },
  { category: "b", value: 1 },
];
const colors = ["#111111", "#222222"];

describe("layoutPie", () => {
  it("12시에서 시계 방향으로 비율만큼 각도를 나눈다", () => {
    const { slices: laid, total } = layoutPie(slices, colors, []);
    expect(total).toBe(4);
    expect(laid.map((s) => s.ratio)).toEqual([0.75, 0.25]);
    expect(laid[0].start).toBeCloseTo(-Math.PI / 2);
    expect(laid[0].end).toBeCloseTo(Math.PI);
    expect(laid[1].end).toBeCloseTo((Math.PI * 3) / 2);
  });

  it("끈 조각은 빼고 남은 조각끼리 비율을 다시 낸다", () => {
    const { slices: laid, total } = layoutPie(slices, colors, [true, false]);
    expect(total).toBe(1);
    expect(laid).toHaveLength(1);
    expect(laid[0]).toMatchObject({ category: "b", ratio: 1, index: 1 });
    expect(laid[0].color).toBe("#222222");
  });
});

describe("sliceCentroid", () => {
  it("조각 가운데 각도의 안쪽 점", () => {
    // 오른쪽 반원(-π/2 → π/2)의 가운데는 3시 방향
    const [x, y] = sliceCentroid({ x: 100, y: 100 }, 50, {
      start: -Math.PI / 2,
      end: Math.PI / 2,
    });
    expect(x).toBeGreaterThan(100);
    expect(y).toBeCloseTo(100);
  });
});
