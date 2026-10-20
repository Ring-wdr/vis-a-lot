import { describe, expect, it } from "vitest";
import type { ScatterMeta } from "@/server/api/types";
import { PointIndex } from "./point-index";
import {
  barStrategy,
  boxplotStrategy,
  invertAxis,
  scatterStrategy,
} from "./strategies";

const meta: ScatterMeta = {
  chartType: "scatter",
  plot: { left: 40, top: 20, width: 200, height: 100 },
  x: { kind: "number", domain: [0, 100] },
  y: { kind: "number", domain: [0, 50] },
  points: {
    px: [40, 140, 240],
    py: [120, 70, 20],
    x: [0, 50, 100],
    y: [0, 25, 50],
    id: [11, 22, 33],
  },
  total: 3,
};

describe("invertAxis", () => {
  it("x는 왼쪽에서 오른쪽으로, y는 아래에서 위로 값을 늘린다", () => {
    expect(invertAxis(meta.x, 40, 200, 140, false)).toBe(50);
    expect(invertAxis(meta.y, 20, 100, 20, true)).toBe(50);
    expect(invertAxis(meta.y, 20, 100, 120, true)).toBe(0);
  });
});

describe("PointIndex", () => {
  const index = new PointIndex(meta.points.px, meta.points.py);

  it("반경 안의 가장 가까운 점을 찾는다", () => {
    expect(index.nearest(145, 72, 24)).toBe(1);
    expect(index.nearest(236, 25, 24)).toBe(2);
  });

  it("반경 밖이면 -1", () => {
    expect(index.nearest(90, 100, 10)).toBe(-1);
  });
});

describe("scatterStrategy", () => {
  const prepared = scatterStrategy.prepare(meta);

  it("그림 영역 밖이면 null", () => {
    expect(scatterStrategy.hitTest(meta, prepared, 10, 10)).toBeNull();
  });

  it("커서 좌표값과 가장 가까운 점, 행 식별자를 돌려준다", () => {
    const hit = scatterStrategy.hitTest(meta, prepared, 142, 68);
    expect(hit?.rows.map((r) => r.label)).toEqual([
      "커서 x",
      "커서 y",
      "가까운 점 x",
      "가까운 점 y",
    ]);
    expect(hit?.rows[2].value).toBe("50");
    expect(hit?.marker).toEqual({ px: 140, py: 70 });
    expect(hit?.rowId).toBe(22);
  });

  it("가까운 점이 없으면 커서 좌표만 보여주고 서버 호출 대상도 없다", () => {
    const hit = scatterStrategy.hitTest(meta, prepared, 90, 100);
    expect(hit?.rows).toHaveLength(2);
    expect(hit?.rowId).toBeUndefined();
  });
});

describe("barStrategy / boxplotStrategy", () => {
  const base = {
    plot: { left: 0, top: 0, width: 300, height: 100 },
    x: { kind: "number" as const, domain: [-0.5, 2.5] as [number, number] },
    y: { kind: "number" as const, domain: [0, 10] as [number, number] },
    categories: ["A", "B", "C"],
    markWidth: 70,
  };

  it("막대 너비 안에서만 범주와 집계값을 보여준다", () => {
    const meta = {
      ...base,
      chartType: "bar" as const,
      agg: "avg" as const,
      bars: [2, 5, 8],
    };
    const hit = barStrategy.hitTest(meta, undefined, 150, 50);
    expect(hit?.rows).toEqual([
      { label: "범주", value: "B" },
      { label: "평균", value: "5", emphasis: true },
    ]);
    expect(hit?.marker).toEqual({ px: 150, py: 50 });
    // 막대 사이 빈 곳
    expect(barStrategy.hitTest(meta, undefined, 100, 50)).toBeNull();
  });

  it("boxplot은 사분위수와 이상치 개수를 보여준다", () => {
    const box = {
      n: 10,
      mean: 5,
      q1: 3,
      median: 5,
      q3: 7,
      lo: 1,
      hi: 9,
      outlierCount: 2,
    };
    const meta = {
      ...base,
      chartType: "boxplot" as const,
      boxes: [box, box, box],
    };
    const hit = boxplotStrategy.hitTest(meta, undefined, 50, 50);
    expect(hit?.rows.find((r) => r.label === "중앙값")?.value).toBe("5");
    expect(hit?.rows.find((r) => r.label === "이상치")?.value).toBe("2개");
  });
});
