import { describe, expect, it } from "vitest";
import * as client from "@/entities/chart/model/chart-options";
import type { ChartSubType, ChartType } from "../api/types";
import {
  DARK_OPTIONS,
  DEFAULT_OPTIONS,
  type LimitLine,
  mergeOptions,
} from "../render/options";
import { CHART_DEFAULTS, defaultsFor } from "./chart-defaults";
import { SELECTION_ROW_CHARTS } from "./chart-fields";
import {
  CATEGORY_ORDER_CHARTS,
  controlLimitSupport,
  OPTION_SUPPORT,
  pickSupported,
  resolveOptions,
  supportsOption,
} from "./chart-options";

describe("chart options", () => {
  it("화면 사본이 서버 표와 같다", () => {
    expect(client.OPTION_SUPPORT).toEqual(OPTION_SUPPORT);
    expect(client.CATEGORY_ORDER_CHARTS).toEqual(CATEGORY_ORDER_CHARTS);
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

describe("관리선 구역", () => {
  const line = (name: string): LimitLine => ({
    name,
    axis: "left",
    color: "#e03131",
    width: 1,
    style: "solid",
    kind: "reference",
    value: 1,
    type: "none",
  });

  it("기본값은 선이 없고, 다크 테마에서도 색이 같다", () => {
    expect(DEFAULT_OPTIONS.controlLimit.lines).toEqual([]);
    expect(DARK_OPTIONS.controlLimit).toBeUndefined();
    expect(
      resolveOptions("scatter", undefined, undefined, "dark").controlLimit,
    ).toEqual(DEFAULT_OPTIONS.controlLimit);
  });

  it("scatter·line·bar만 구역을 쓰고, 나머지는 저장하지 않는다", () => {
    const supported = (Object.keys(OPTION_SUPPORT) as ChartType[]).filter((t) =>
      supportsOption(t, "controlLimit"),
    );
    expect(supported.sort()).toEqual(["bar", "line", "scatter"]);
    expect(
      pickSupported("boxplot", { controlLimit: { lines: [line("A")] } }),
    ).toBeUndefined();
  });

  it("item에 선 목록을 정하면 공통 목록 대신 그 목록을 쓴다", () => {
    const common = {
      controlLimit: { lines: [line("A"), line("B")], fitAxis: false },
    };
    // 목록을 적지 않은 item은 공통 목록을 따르고, 낱개 칸만 덮는다.
    expect(
      resolveOptions("scatter", common, {
        controlLimit: { highlightOut: false },
      }).controlLimit,
    ).toMatchObject({
      lines: [line("A"), line("B")],
      fitAxis: false,
      highlightOut: false,
    });
    expect(
      resolveOptions("scatter", common, {
        controlLimit: { lines: [line("C")] },
      }).controlLimit.lines,
    ).toEqual([line("C")]);
    // 빈 목록이면 그 item만 선이 없다.
    expect(
      resolveOptions("scatter", common, { controlLimit: { lines: [] } })
        .controlLimit.lines,
    ).toEqual([]);
  });

  it("차트·하위 차트·x 타입별로 쓸 수 있는 선", () => {
    expect(controlLimitSupport({ chartType: "scatter" }, "datetime")).toEqual({
      left: ["reference", "column", "band"],
      bottom: ["reference"],
      multi: true,
    });
    expect(
      controlLimitSupport({ chartType: "line" }, "numeric")?.bottom,
    ).toEqual(["reference", "column", "band"]);
    expect(
      controlLimitSupport({ chartType: "line", subType: "ecdf" }),
    ).toBeNull();
    expect(controlLimitSupport({ chartType: "bar" })).toEqual({
      left: ["reference", "column"],
      bottom: [],
      multi: false,
    });
    expect(
      controlLimitSupport({ chartType: "bar", subType: "stack100" })?.left,
    ).toEqual(["reference"]);
    expect(controlLimitSupport({ chartType: "histogram" })).toBeNull();
  });

  it("화면 사본이 서버와 같은 규칙으로 관리선 지원을 정한다", () => {
    const subTypes: (ChartSubType | undefined)[] = [
      undefined,
      "none",
      "ecdf",
      "ncdf",
      "probability",
      "side",
      "stack",
      "stack100",
    ];
    for (const chartType of Object.keys(OPTION_SUPPORT) as ChartType[])
      for (const subType of subTypes)
        for (const xType of ["numeric", "datetime", "categorical"] as const)
          expect(
            client.controlLimitSupport({ chartType, subType }, xType),
          ).toEqual(controlLimitSupport({ chartType, subType }, xType));
  });
});

describe("선택 값 구역", () => {
  it("선택 영역을 행으로 바꾸는 차트만 구역을 쓰고, 나머지는 저장하지 않는다", () => {
    const supported = (Object.keys(OPTION_SUPPORT) as ChartType[]).filter((t) =>
      supportsOption(t, "selection"),
    );
    expect(supported.sort()).toEqual([...SELECTION_ROW_CHARTS].sort());
    const patch = { selection: { fields: ["lot"] } };
    expect(pickSupported("pie", patch)).toBeUndefined();
    expect(resolveOptions("bar", patch, undefined).selection).toEqual({
      fields: ["lot"],
      separator: "-",
    });
  });

  it("item 개별 fields는 공통 목록을 통째로 바꾼다", () => {
    expect(
      resolveOptions(
        "scatter",
        { selection: { fields: ["a", "b"], separator: "/" } },
        { selection: { fields: ["c"] } },
      ).selection,
    ).toEqual({ fields: ["c"], separator: "/" });
  });
});
