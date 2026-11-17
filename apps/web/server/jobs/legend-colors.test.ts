import { describe, expect, it, vi } from "vitest";
import type { ChartItem, ChartRecord } from "../charts/chart-store";
import type { ChartOptionsPatch } from "../render/options";
import { legendColors } from "./job-manager";

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
