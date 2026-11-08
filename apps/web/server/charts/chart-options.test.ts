import { describe, expect, it } from "vitest";
import * as client from "@/entities/chart/model/chart-options";
import type { ChartType } from "../api/types";
import { DEFAULT_OPTIONS, mergeOptions } from "../render/options";
import { CHART_DEFAULTS, defaultsFor } from "./chart-defaults";
import {
  OPTION_SUPPORT,
  resolveOptions,
  supportsOption,
} from "./chart-options";

describe("chart options", () => {
  it("화면 사본이 서버 표와 같다", () => {
    expect(client.OPTION_SUPPORT).toEqual(OPTION_SUPPORT);
  });

  it("draw는 화면이 GET /defaults로 받는 기본값 객체를 그대로 쓴다", () => {
    expect(CHART_DEFAULTS.options).toBe(DEFAULT_OPTIONS);
    expect(resolveOptions("scatter", undefined, undefined)).toBe(
      CHART_DEFAULTS.options,
    );
  });

  it("legend 위치는 전체 값 위에 차트 종류별 값을 덮는다", () => {
    expect(CHART_DEFAULTS.legendPosition).toBe("top");
    // funnel만 단계 이름이 길어 오른쪽이다.
    expect(defaultsFor("funnel").legendPosition).toBe("right");
    expect(defaultsFor("scatter").legendPosition).toBe("top");
  });

  it("화면도 서버와 같은 규칙으로 차트 종류별 기본값을 합친다", () => {
    for (const type of Object.keys(OPTION_SUPPORT) as ChartType[]) {
      expect(client.chartTypeDefaults(CHART_DEFAULTS, type)).toEqual(
        defaultsFor(type),
      );
    }
    expect(client.chartTypeDefaults(CHART_DEFAULTS, undefined)).toEqual({
      legendPosition: CHART_DEFAULTS.legendPosition,
      options: CHART_DEFAULTS.options,
    });
  });

  it("전체 기본값 → 차트 종류별 → 공통 → 개별 순으로 덮는다", () => {
    const defaults = {
      ...CHART_DEFAULTS,
      charts: {
        bar: {
          options: {
            title: { align: "center", bold: false, color: "#111111" },
          },
        },
      },
    } as const;
    const own = defaultsFor("bar", "light", defaults as never).options;
    expect(own.title).toEqual({
      ...DEFAULT_OPTIONS.title,
      align: "center",
      bold: false,
      color: "#111111",
    });
    // 다른 종류는 전체 값 그대로
    expect(defaultsFor("line", "light", defaults as never).options).toBe(
      DEFAULT_OPTIONS,
    );
    const resolved = mergeOptions(
      mergeOptions(own, { title: { align: "right", bold: true } }),
      { title: { align: "left" } },
    );
    expect(resolved.title).toMatchObject({
      align: "left",
      bold: true,
      color: "#111111",
    });
  });

  it("draw는 차트 종류별 기본값 위에 공통·개별 속성을 덮는다", () => {
    // radar는 선 굵기 기본값이 2다.
    expect(resolveOptions("radar", undefined, undefined).size).toEqual({
      ...DEFAULT_OPTIONS.size,
      lineWidth: 2,
    });
    expect(
      resolveOptions("radar", { size: { lineWidth: 3 } }, undefined).size
        .lineWidth,
    ).toBe(3);
    expect(
      resolveOptions(
        "radar",
        { size: { lineWidth: 3, pointFixed: 5 } },
        { size: { lineWidth: 4 } },
      ).size,
    ).toMatchObject({ lineWidth: 4, pointFixed: 5 });
    // 종류별 값이 없는 차트는 전체 값
    expect(resolveOptions("line", undefined, undefined).size.lineWidth).toBe(
      DEFAULT_OPTIONS.size.lineWidth,
    );
  });

  it("원본 표에서 X인 칸은 쓰지 않는다", () => {
    expect(supportsOption("bar", "score")).toBe(false);
    expect(supportsOption("heatmap", "legend")).toBe(false);
    expect(supportsOption("candle", "value")).toBe(false);
    expect(supportsOption("boxplot", "tooltip")).toBe(false);
    expect(supportsOption("scatter", "prediction")).toBe(true);
  });

  it("기본값 → 공통 → 개별 순으로 깊게 합치고, 쓰지 않는 구역은 기본값이다", () => {
    const resolved = resolveOptions(
      "bar",
      { title: { align: "center", bold: false }, score: { visible: true } },
      { title: { align: "right" }, axes: { y: { min: 0 } } },
    );
    expect(resolved.title).toEqual({
      ...DEFAULT_OPTIONS.title,
      align: "right",
      bold: false,
    });
    expect(resolved.axes.y.min).toBe(0);
    expect(resolved.axes.y.grid).toEqual(DEFAULT_OPTIONS.axes.y.grid);
    expect(resolved.score).toEqual(DEFAULT_OPTIONS.score);
  });

  it("배열과 null은 통째로 바꾼다", () => {
    const merged = mergeOptions(DEFAULT_OPTIONS, {
      score: { kinds: ["cpk"], ucl: null },
    });
    expect(merged.score.kinds).toEqual(["cpk"]);
    expect(merged.score.ucl).toBeNull();
  });
});
