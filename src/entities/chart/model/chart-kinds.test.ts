import { describe, expect, it } from "vitest";
import { modeSupported } from "@/entities/workspace/model/workspace-store";
import { drawsLegend, legendColumnOf, supports } from "./chart-kinds";

describe("chart kinds", () => {
  it("점 삭제는 점을 그리는 차트에서만 쓴다", () => {
    expect(supports("scatter", "delete")).toBe(true);
    expect(supports("bar", "delete")).toBe(false);
    expect(modeSupported("rectDelete", "boxplot")).toBe(false);
  });

  it("기본 모드는 모든 차트, 그린 차트가 없으면 기능은 꺼진다", () => {
    expect(modeSupported("normal", "bar")).toBe(true);
    expect(supports(undefined, "pan")).toBe(false);
  });

  it("sankey는 선택·체크박스만 쓰고 legend 컬럼 대신 출발 노드로 legend를 그린다", () => {
    expect(supports("sankey", "select")).toBe(true);
    expect(supports("sankey", "checkbox")).toBe(true);
    expect(supports("sankey", "zoom")).toBe(false);
    expect(modeSupported("pan", "sankey")).toBe(false);
    const spec = { chartType: "sankey", legend: "lot" } as const;
    expect(legendColumnOf(spec)).toBeNull();
    expect(drawsLegend({ ...spec, legend: null })).toBe(true);
    expect(drawsLegend({ chartType: "bar", legend: null })).toBe(false);
  });
});
