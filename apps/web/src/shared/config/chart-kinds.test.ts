import { describe, expect, it } from "vitest";
import {
  drawsLegend,
  isDistributionLine,
  legendColumnOf,
  subTypeOf,
  supports,
} from "./chart-kinds";

describe("chart kinds", () => {
  it("점 삭제는 점을 그리는 차트에서만 쓴다", () => {
    expect(supports({ chartType: "scatter" }, "delete")).toBe(true);
    expect(supports({ chartType: "line" }, "delete")).toBe(true);
    expect(supports({ chartType: "bar" }, "delete")).toBe(false);
  });

  it("기본 모드는 모든 차트, 그린 차트가 없으면 기능은 꺼진다", () => {
    expect(supports(undefined, "pan")).toBe(false);
  });

  it("sankey는 선택·체크박스만 쓰고 legend 컬럼 대신 출발 노드로 legend를 그린다", () => {
    expect(supports({ chartType: "sankey" }, "select")).toBe(true);
    expect(supports({ chartType: "sankey" }, "checkbox")).toBe(true);
    expect(supports({ chartType: "sankey" }, "zoom")).toBe(false);
    const spec = { chartType: "sankey", legend: "lot" } as const;
    expect(legendColumnOf(spec)).toBeNull();
    expect(drawsLegend({ ...spec, legend: null })).toBe(true);
    expect(drawsLegend({ chartType: "bar", legend: null })).toBe(false);
  });

  it("하위 차트는 그 차트에 없는 값이면 기본값이다", () => {
    expect(subTypeOf({ chartType: "bar" })).toBe("side");
    expect(subTypeOf({ chartType: "bar", subType: "doughnut" })).toBe("side");
    expect(subTypeOf({ chartType: "pie", subType: "sunburst" })).toBe(
      "sunburst",
    );
    expect(subTypeOf({ chartType: "scatter", subType: "stack" })).toBe(
      undefined,
    );
  });

  it("분포 line은 지우기·선택 필드를 쓰지 않는다", () => {
    const ecdf = { chartType: "line", subType: "ecdf" } as const;
    expect(isDistributionLine(ecdf)).toBe(true);
    expect(supports(ecdf, "delete")).toBe(false);
    expect(supports(ecdf, "selectField")).toBe(false);
    expect(supports(ecdf, "zoom")).toBe(true);
  });

  it("pie sunburst만 legend 컬럼을 쓴다", () => {
    expect(legendColumnOf({ chartType: "pie", legend: "lot" })).toBeNull();
    expect(
      legendColumnOf({ chartType: "pie", subType: "sunburst", legend: "lot" }),
    ).toBe("lot");
  });
});
