import { describe, expect, it } from "vitest";
import type { CategoryMeta, ScatterMeta } from "@/shared/api/types";
import { limitRows, outOfSpec, stepAt } from "./limit-hit";
import { barStrategy, scatterStrategy } from "./strategies";

// 그림 영역 200×100, x 0..100, y 0..50 → x 1 = 2px, y 1 = 2px
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
  limits: {
    lines: [
      { name: "USL", axis: "left", type: "usl", value: 40 },
      { name: "LSL", axis: "left", type: "lsl", value: 10 },
      { name: "목표 x", axis: "bottom", type: "none", value: 25 },
      {
        name: "구간",
        axis: "left",
        type: "none",
        steps: [
          [0, 50, 30],
          [50, 100, 20],
        ],
      },
    ],
    out: 1,
  },
};
const yPx = (v: number) => 120 - v * 2;
const xPx = (v: number) => 40 + v * 2;

describe("관리선 툴팁", () => {
  it("커서가 선에서 4px 안이면 그 선의 이름·값을 더한다", () => {
    expect(limitRows(meta, xPx(70), yPx(40) + 3)).toEqual([
      { id: "limit-0", label: "USL", value: "40" },
    ]);
    expect(limitRows(meta, xPx(70), yPx(40) + 5)).toEqual([]);
    expect(limitRows(meta, xPx(25) - 4, yPx(5)).map((r) => r.label)).toEqual([
      "목표 x",
    ]);
  });

  it("구간별 선은 커서 x가 든 구간의 값이다", () => {
    expect(limitRows(meta, xPx(20), yPx(30)).map((r) => r.value)).toEqual([
      "30",
    ]);
    expect(limitRows(meta, xPx(70), yPx(30))).toEqual([]);
    expect(limitRows(meta, xPx(70), yPx(20)).map((r) => r.value)).toEqual([
      "20",
    ]);
    expect(stepAt([[0, 50, 1]], 50)).toEqual([0, 50, 1]);
    expect(
      stepAt(
        [
          [0, 50, 1],
          [50, 100, 2],
        ],
        50,
      )?.[2],
    ).toBe(2);
  });

  it("띠는 두 값을 함께 적는다", () => {
    const band: ScatterMeta = {
      ...meta,
      limits: {
        lines: [
          { name: "띠", axis: "left", type: "none", value: 10, value2: 20 },
        ],
        out: 0,
      },
    };
    expect(limitRows(band, xPx(50), yPx(20))).toEqual([
      { id: "limit-0", label: "띠", value: "10 ~ 20" },
    ]);
  });

  it("USL보다 크거나 LSL보다 작은 점을 이탈로 본다", () => {
    expect(outOfSpec(meta.limits, 50, 45)?.name).toBe("USL");
    expect(outOfSpec(meta.limits, 50, 5)?.name).toBe("LSL");
    expect(outOfSpec(meta.limits, 50, 25)).toBeUndefined();
    expect(outOfSpec(undefined, 50, 45)).toBeUndefined();
    // 경계 값은 이탈이 아니다.
    expect(outOfSpec(meta.limits, 50, 40)).toBeUndefined();
  });

  it("USL이 LSL보다 작으면(뒤집힌 규격) 그 축은 판정하지 않는다", () => {
    const flipped = {
      lines: [
        { name: "U", axis: "left" as const, type: "usl" as const, value: 10 },
        { name: "L", axis: "left" as const, type: "lsl" as const, value: 40 },
        {
          name: "X",
          axis: "bottom" as const,
          type: "usl" as const,
          value: 60,
        },
      ],
      out: 0,
    };
    expect(outOfSpec(flipped, 50, 45)).toBeUndefined();
    expect(outOfSpec(flipped, 70, 45)?.name).toBe("X");
  });

  it("scatter 툴팁: 가까운 점이 이탈이면 '규격 이탈'에 벗어난 선 이름을 적는다", () => {
    const prepared = scatterStrategy.prepare(meta);
    const top = scatterStrategy.hitTest(meta, prepared, 238, 22);
    expect(top?.rows.find((r) => r.id === "limitOut")).toMatchObject({
      label: "규격 이탈",
      value: "USL",
    });
    const mid = scatterStrategy.hitTest(meta, prepared, 140, 70);
    expect(mid?.rows.some((r) => r.id === "limitOut")).toBe(false);
  });

  it("bar 툴팁: 막대 밖이어도 선 가까이면 선 줄만 보이고, 막대가 USL을 넘으면 이탈", () => {
    const bar: CategoryMeta = {
      chartType: "bar",
      plot: { left: 0, top: 0, width: 100, height: 100 },
      x: { kind: "number", domain: [-0.5, 1.5] },
      y: { kind: "number", domain: [0, 100] },
      categories: ["A", "B"],
      markWidth: 20,
      groupCount: 1,
      groupGap: 0,
      bars: [[90], [30]],
      limits: {
        lines: [{ name: "상한", axis: "left", type: "usl", value: 80 }],
        out: 1,
      },
    };
    // 막대 사이 빈 곳, y=80 선 위
    expect(barStrategy.hitTest(bar, undefined, 50, 20)?.rows).toEqual([
      { id: "limit-0", label: "상한", value: "80" },
    ]);
    expect(barStrategy.hitTest(bar, undefined, 50, 60)).toBeNull();
    const a = barStrategy.hitTest(bar, undefined, 25, 50);
    expect(a?.rows.find((r) => r.id === "limitOut")?.value).toBe("상한");
    const b = barStrategy.hitTest(bar, undefined, 75, 90);
    expect(b?.rows.some((r) => r.id === "limitOut")).toBe(false);
  });

  it("로그 축에서도 선 위치를 맞게 찾는다", () => {
    const log: ScatterMeta = {
      ...meta,
      y: { kind: "number", domain: [1, 100], log: true },
      limits: {
        lines: [{ name: "10", axis: "left", type: "none", value: 10 }],
        out: 0,
      },
    };
    // log10(10)은 0..2의 가운데
    expect(limitRows(log, 100, 70)).toHaveLength(1);
    expect(limitRows(log, 100, 80)).toHaveLength(0);
  });
});
