import { describe, expect, it } from "vitest";
import type { HistogramMeta } from "@/shared/api/types";
import { histogramStrategy } from "./strategies";

describe("histogramStrategy", () => {
  const meta: HistogramMeta = {
    chartType: "histogram",
    plot: { left: 0, top: 0, width: 200, height: 100 },
    x: { kind: "number", domain: [0, 20] },
    y: { kind: "number", domain: [0, 10] },
    bins: { lo: 0, step: 5, count: 4 },
    counts: [
      [2, 4],
      [6, 0],
      [1, 1],
      [3, 8],
    ],
    groupCount: 2,
    legend: {
      title: "종류",
      values: ["x", "y"],
      colors: ["#2a78d6", "#eb6834"],
      box: { x: 150, y: 0, width: 50, height: 10 },
      entries: [
        {
          value: "x",
          color: "#2a78d6",
          index: 0,
          rect: { x: 150, y: 0, width: 20, height: 10 },
          marker: { x: 155, y: 5 },
          visible: true,
        },
        {
          value: "y",
          color: "#eb6834",
          index: 1,
          rect: { x: 175, y: 0, width: 20, height: 10 },
          marker: { x: 180, y: 5 },
          visible: false,
        },
      ],
      hidden: 0,
    },
  };

  it("가리킨 구간의 범위와 legend 값, 개수를 보여준다", () => {
    // x 값 6 → 구간 [5, 10)의 앞 칸(x)
    const hit = histogramStrategy.hitTest(meta, undefined, 60, 50);
    expect(hit?.rows).toEqual([
      { label: "구간", value: "5 ~ 10 미만" },
      { label: "종류", value: "x" },
      { label: "개수", value: "6", emphasis: true },
    ]);
    // 칸 [5, 7.5) → 50..75px, 개수 6 → 위 40px
    expect(hit?.highlight).toEqual({ x: 47, y: 37, width: 31, height: 63 });
  });

  it("마지막 구간은 끝값을 포함하고, 끈 legend 값의 칸은 무시한다", () => {
    const hit = histogramStrategy.hitTest(meta, undefined, 155, 50);
    expect(hit?.rows[0]).toEqual({ label: "구간", value: "15 ~ 20" });
    expect(histogramStrategy.hitTest(meta, undefined, 190, 50)).toBeNull();
  });
});
