import { describe, expect, it } from "vitest";
import * as client from "@/entities/chart/model/chart-options";
import { DEFAULT_OPTIONS, mergeOptions } from "../render/options";
import { CHART_DEFAULTS } from "./chart-defaults";
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
    // legend 위치 기본값도 같은 곳에 있다. funnel만 단계 이름이 길어 오른쪽이다.
    expect(CHART_DEFAULTS.legendPosition.funnel).toBe("right");
    expect(CHART_DEFAULTS.legendPosition.scatter).toBe("top");
    expect(resolveOptions("scatter", undefined, undefined)).toBe(
      CHART_DEFAULTS.options,
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
