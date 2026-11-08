import { describe, expect, it } from "vitest";
import { layoutTreemap, leafAt, rectCenter } from "./treemap";

const area = (r: { x0: number; y0: number; x1: number; y1: number }) =>
  (r.x1 - r.x0) * (r.y1 - r.y0);

describe("layoutTreemap", () => {
  it("0 이하·빈 값은 빼고, 넓이는 값에 비례하며 [0,1] 안에 놓는다", () => {
    const { leaves, parents } = layoutTreemap(
      ["a", "b", "c", "d"],
      [[3], [1], [0], [null]],
      0,
      [],
      400,
      200,
      true,
    );
    expect(parents).toEqual([]);
    expect(leaves.map((l) => l.name).sort()).toEqual(["a", "b"]);
    const a = leaves.find((l) => l.name === "a");
    const b = leaves.find((l) => l.name === "b");
    if (!a || !b) throw new Error("missing leaf");
    // 칸 사이 간격 때문에 정확히 3배는 아니다.
    expect(area(a) / area(b)).toBeGreaterThan(2.5);
    for (const l of leaves) {
      expect(l.x0).toBeGreaterThanOrEqual(0);
      expect(l.x1).toBeLessThanOrEqual(1);
      expect(l.y0).toBeGreaterThanOrEqual(0);
      expect(l.y1).toBeLessThanOrEqual(1);
      expect(l.y1).toBeGreaterThan(l.y0);
    }
  });

  it("legend 값이 부모 묶음이고, 숨긴 값은 레이아웃에서 뺀다", () => {
    const bars = [
      [2, 1],
      [1, 4],
    ];
    const shown = layoutTreemap(
      ["a", "b"],
      bars,
      2,
      [false, false],
      300,
      300,
      true,
    );
    expect(shown.parents.map((p) => p.g).sort()).toEqual([0, 1]);
    expect(shown.leaves).toHaveLength(4);
    // 잎은 자기 부모 안에 있다.
    for (const l of shown.leaves) {
      const p = shown.parents.find((q) => q.g === l.g);
      if (!p) throw new Error("missing parent");
      expect(l.x0).toBeGreaterThanOrEqual(p.x0);
      expect(l.y1).toBeLessThanOrEqual(p.y1);
    }
    const hidden = layoutTreemap(
      ["a", "b"],
      bars,
      2,
      [false, true],
      300,
      300,
      true,
    );
    expect(hidden.parents.map((p) => p.g)).toEqual([0]);
    expect(hidden.leaves.every((l) => l.g === 0)).toBe(true);
  });
});

describe("leafAt", () => {
  it("데이터 좌표의 점이 든 잎을 찾는다", () => {
    const leaves = [
      { x0: 0, y0: 0, x1: 0.5, y1: 1 },
      { x0: 0.5, y0: 0, x1: 1, y1: 1 },
    ];
    expect(leafAt(leaves, 0.7, 0.2)).toBe(1);
    expect(leafAt(leaves, 2, 0.2)).toBe(-1);
    expect(rectCenter(leaves[0])).toEqual([0.25, 0.5]);
  });
});
