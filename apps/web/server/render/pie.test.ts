import { describe, expect, it } from "vitest";
import { layoutChildren, layoutPie, renderPie, sliceCentroid } from "./pie";

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

/** 그리기 호출만 세는 가짜 canvas */
function fakeCtx() {
  const calls: { op: string; args: unknown[] }[] = [];
  const state: Record<string, unknown> = {
    canvas: { width: 300, height: 240 },
  };
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key === "measureText")
        return (t: string) => ({ width: String(t).length * 6 });
      if (key in target) return target[key];
      return (...args: unknown[]) => calls.push({ op: key, args });
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, calls };
}

describe("pie 하위 차트", () => {
  const input = (variant?: "doughnut" | "pie3d" | "sunburst") => ({
    width: 300,
    height: 240,
    title: "t",
    variant,
    slices: [
      {
        category: "a",
        value: 3,
        children: [
          { category: "x", value: 1 },
          { category: "y", value: 2 },
        ],
      },
      { category: "b", value: 1 },
    ],
    legend: {
      title: "범주",
      values: ["a", "b"],
      colors,
      position: "top" as const,
    },
  });
  const noop = () => {};

  it("doughnut은 가운데 빈 곳의 반지름을 준다", () => {
    const meta = renderPie(fakeCtx().ctx, input("doughnut"), noop);
    expect(meta.variant).toBe("doughnut");
    expect(meta.innerRadius).toBeCloseTo(meta.radius * 0.55);
    expect(meta.radiusY).toBeUndefined();
  });

  it("pie3d는 윗면을 눕힌 타원으로 그리고 앞쪽 옆면을 더 칠한다", () => {
    const flat = fakeCtx();
    renderPie(flat.ctx, input(), noop);
    const tilted = fakeCtx();
    const meta = renderPie(tilted.ctx, input("pie3d"), noop);
    expect(meta.radiusY).toBeLessThan(meta.radius);
    const fills = (c: typeof flat.calls) =>
      c.filter((x) => x.op === "fill").length;
    expect(fills(tilted.calls)).toBeGreaterThan(fills(flat.calls));
  });

  it("sunburst는 바깥 고리에 children을 부모 조각 각도 안에 나눈다", () => {
    const meta = renderPie(fakeCtx().ctx, input("sunburst"), noop);
    expect(meta.ring).toBeLessThan(meta.radius);
    const [a] = meta.slices;
    const children = meta.children ?? [];
    expect(children.map((c) => c.category)).toEqual(["x", "y"]);
    expect(children[0].start).toBeCloseTo(a.start);
    expect(children[1].end).toBeCloseTo(a.end);
    expect(children[1].ratio).toBeCloseTo(2 / 3);
    // 조각 metadata에는 children을 싣지 않는다.
    expect(a).not.toHaveProperty("children");
  });

  it("layoutChildren: children이 없는 조각은 건너뛴다", () => {
    const { slices: laid } = layoutPie(slices, colors, []);
    expect(layoutChildren(laid, "#ffffff")).toEqual([]);
  });
});
