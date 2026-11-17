import { describe, expect, it, vi } from "vitest";
import type { ChartItem, ChartRecord } from "../charts/chart-store";
import { type ChartOptionsPatch, DEFAULT_OPTIONS } from "../render/options";
import { legendColors, legendOrderOf } from "./job-manager";

vi.mock("../runtime", () => ({ getRuntime: () => ({ render: { size: 1 } }) }));

const chartOf = (options: ChartOptionsPatch, legend?: Record<string, string>) =>
  ({
    spec: {
      chartType: "bar",
      common: { options, ...(legend ? { legendColors: legend } : {}) },
    },
  }) as unknown as ChartRecord;

const VALUES = ["a", "b", "c"];

describe("legendColors · palette.colors", () => {
  it("색 목록이 비면 기본 팔레트 순서다", () => {
    expect(legendColors(chartOf({}), {} as ChartItem, VALUES)).toEqual([
      "#2a78d6",
      "#eb6834",
      "#1baf7a",
    ]);
  });

  it("색 목록이 있으면 기본 팔레트를 대신하고 모자라면 돌려 쓴다", () => {
    const chart = chartOf({ palette: { colors: ["#111111", "#222222"] } });
    expect(legendColors(chart, {} as ChartItem, VALUES)).toEqual([
      "#111111",
      "#222222",
      "#111111",
    ]);
  });

  it("item 개별·공통 legend 색과 그라데이션이 색 목록보다 먼저다", () => {
    const chart = chartOf(
      { palette: { colors: ["#111111", "#222222", "#333333"] } },
      { b: "#bbbbbb" },
    );
    const item = {
      props: { legendColors: { a: "#aaaaaa" } },
    } as unknown as ChartItem;
    expect(legendColors(chart, item, VALUES)).toEqual([
      "#aaaaaa",
      "#bbbbbb",
      "#333333",
    ]);
    const gradient = chartOf({
      palette: {
        colors: ["#111111"],
        gradient: true,
        start: "#000000",
        middle: "",
        end: "#ffffff",
      },
    });
    expect(legendColors(gradient, {} as ChartItem, ["a", "b"])).toEqual([
      "#000000",
      "#ffffff",
    ]);
  });
});

describe("legendOrderOf · legend 순서", () => {
  const style = (patch: Partial<typeof DEFAULT_OPTIONS.legend>) => ({
    ...DEFAULT_OPTIONS.legend,
    ...patch,
  });
  const typed = (chartType: string) =>
    ({ spec: { chartType, common: {} } }) as unknown as ChartRecord;
  const lines = ["L2", "L10", "L1"];

  it("기본값(default, 빈 목록)이면 순서를 넘기지 않는다", () => {
    expect(legendOrderOf(typed("bar"), lines, style({}))).toBeUndefined();
  });

  it("legend 컬럼을 고르는 차트는 직접 순서 + 자연 정렬을 values 인덱스로 넘긴다", () => {
    expect(
      legendOrderOf(typed("bar"), lines, style({ sort: "natural" })),
    ).toEqual([2, 0, 1]);
    expect(
      legendOrderOf(typed("scatter"), lines, style({ order: ["L1"] })),
    ).toEqual([2, 0, 1]);
  });

  it("차트가 legend를 정하는 종류와 legend 컬럼이 없는 item은 쓰지 않는다", () => {
    for (const type of ["pie", "funnel", "sankey", "waterfall", "candle"])
      expect(
        legendOrderOf(typed(type), lines, style({ sort: "natural" })),
      ).toBeUndefined();
    expect(
      legendOrderOf(typed("bar"), undefined, style({ sort: "natural" })),
    ).toBeUndefined();
  });

  it("순서를 바꿔도 값의 색은 그대로다 (색은 values 순번을 따른다)", () => {
    const chart = chartOf({ legend: { sort: "natural", order: ["L10"] } });
    expect(legendColors(chart, {} as ChartItem, lines)).toEqual(
      legendColors(chartOf({}), {} as ChartItem, lines),
    );
  });
});
