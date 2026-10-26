import { afterEach, describe, expect, it } from "vitest";
import * as client from "@/entities/chart/model/chart-options";
import type { ChartType } from "../api/types";
import { DARK_OPTIONS, DEFAULT_OPTIONS } from "../render/options";
import { applyTheme, THEME } from "../render/theme";
import { CHART_DEFAULTS, defaultsFor } from "./chart-defaults";
import { OPTION_SUPPORT, resolveOptions } from "./chart-options";
import { sizeKeyOf } from "./chart-store";

const HEX = /^#[0-9a-f]{6}$/i;

/** 부분 값의 끝 값(leaf)을 경로와 함께 모은다. */
function leaves(value: unknown, path: string[] = []): [string[], unknown][] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return [[path, value]];
  return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]));
}

function at(value: unknown, path: string[]) {
  return path.reduce<unknown>(
    (v, k) => (v as Record<string, unknown> | undefined)?.[k],
    value,
  );
}

describe("다크 테마 기본값", () => {
  it("다크 값은 기본값에 있는 색 칸만 바꾼다", () => {
    for (const [path, value] of leaves(DARK_OPTIONS)) {
      expect(value, path.join(".")).toMatch(HEX);
      expect(at(DEFAULT_OPTIONS, path), path.join(".")).toMatch(HEX);
    }
  });

  it("데이터 색(palette·focus)은 테마와 상관없이 같다", () => {
    expect(DARK_OPTIONS.palette).toBeUndefined();
    expect(DARK_OPTIONS.focus).toBeUndefined();
    const dark = defaultsFor("scatter", "dark").options;
    expect(dark.palette).toEqual(DEFAULT_OPTIONS.palette);
    expect(dark.focus).toEqual(DEFAULT_OPTIONS.focus);
  });

  it("글자·바탕 계열은 다크 값이 된다", () => {
    const dark = defaultsFor("scatter", "dark").options;
    expect(dark.title.color).toBe(DARK_OPTIONS.title?.color);
    expect(dark.panel.backColor).toBe(DARK_OPTIONS.panel?.backColor);
    expect(dark.axes.y.grid.color).toBe(DARK_OPTIONS.axes?.y?.grid?.color);
    // 색이 아닌 값은 그대로
    expect(dark.axes.x.grid.visible).toBe(false);
    expect(dark.title.fontSize).toBe(DEFAULT_OPTIONS.title.fontSize);
  });

  it("사용자가 정한 색은 다크 테마에서도 그대로 남는다", () => {
    const resolved = resolveOptions(
      "scatter",
      { title: { color: "#123456" } },
      { axes: { y: { label: { color: "#abcdef" } } } },
      "dark",
    );
    expect(resolved.title.color).toBe("#123456");
    expect(resolved.axes.y.label.color).toBe("#abcdef");
    // 정하지 않은 칸은 다크 기본값
    expect(resolved.axes.x.label.color).toBe(
      DARK_OPTIONS.axes?.x?.label?.color,
    );
  });

  it("차트 종류별 값은 다크 값 위에 덮인다", () => {
    expect(defaultsFor("radar", "dark").options.size.lineWidth).toBe(2);
    expect(defaultsFor("radar", "dark").options.title.color).toBe(
      DARK_OPTIONS.title?.color,
    );
  });

  it("화면도 서버와 같은 규칙으로 테마별 기본값을 합친다", () => {
    for (const type of Object.keys(OPTION_SUPPORT) as ChartType[]) {
      expect(client.chartTypeDefaults(CHART_DEFAULTS, type, "dark")).toEqual(
        defaultsFor(type, "dark"),
      );
    }
  });
});

describe("테마별 PNG 캐시와 렌더 색", () => {
  afterEach(() => applyTheme("light"));

  it("다크 테마 PNG는 다른 캐시 키를 쓴다", () => {
    expect(sizeKeyOf({ width: 300, height: 200 })).toBe("300x200");
    expect(sizeKeyOf({ width: 300, height: 200, theme: "light" })).toBe(
      "300x200",
    );
    expect(
      sizeKeyOf({ width: 300, height: 200, pixelRatio: 2, theme: "dark" }),
    ).toBe("300x200@2~dark");
  });

  it("applyTheme이 렌더러가 읽는 테마 색을 바꾼다", () => {
    const light = { ...THEME };
    applyTheme("dark");
    expect(THEME.surface).toBe(DARK_OPTIONS.panel?.backColor);
    expect(THEME.textPrimary).not.toBe(light.textPrimary);
    applyTheme();
    expect(THEME).toEqual(light);
  });
});
