import { describe, expect, it } from "vitest";
import type { ScatterMeta } from "@/server/api/types";
import { PointIndex } from "./point-index";
import { invertAxis, scatterStrategy } from "./strategies";

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
