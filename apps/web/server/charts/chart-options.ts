// 차트 종류별로 쓸 수 있는 속성 구역. 원본 제품의 'Availability of Chart-Specific Options' 표에서
// 이 프로토타입에 있는 14종만 옮기고, 렌더러에 그 개념이 없는 칸은 X로 둔다 (주석에 이유).
// 관리선(controlLimit)은 원본 표 밖의 구역으로, 이탈을 판정할 단위와 값 축이 분명한 scatter·line·bar만 쓴다.
// 화면은 @server를 import하지 않으므로 같은 표를 src/entities/chart/model/chart-options.ts에 따로 둔다.

import type { ChartSpec, ChartTheme, ChartType } from "../api/types";
import type { LogicalType } from "../data/dataset-schema";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  LIMIT_KINDS,
  type LimitKind,
  mergeOptions,
  OPTION_SECTIONS,
  type OptionSection,
} from "../render/options";
import { defaultsFor } from "./chart-defaults";
import { isDistributionLine, subTypeOf } from "./chart-fields";

const ALL = OPTION_SECTIONS;
const without = (...omit: OptionSection[]) =>
  ALL.filter((s) => !omit.includes(s));

/**
 * 원본 표 대비 차이
 * - Wafer, Selection, Multi Axis: 해당 차트·기능이 없어 구역 자체를 두지 않는다.
 * - Axes: pie·treemap·funnel은 원본 O지만 축을 그리지 않는 차트라 X.
 * - Color(legend 모양): 원본 표의 Color 행을 legend 구역으로 본다.
 */
export const OPTION_SUPPORT: Record<ChartType, readonly OptionSection[]> = {
  scatter: ALL,
  line: ALL,
  bar: without("score", "prediction"),
  boxplot: without(
    "score",
    "prediction",
    "tooltip",
    "expression",
    "controlLimit",
  ),
  histogram: without(
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  pie: without(
    "axes",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  gantt: without("score", "prediction", "expression", "controlLimit"),
  treemap: without(
    "axes",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  heatmap: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  candle: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "value",
    "expression",
    "controlLimit",
  ),
  waterfall: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  funnel: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  radar: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
  sankey: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
    "controlLimit",
  ),
};

/** 범주 순서(axes.x.categorySort·categoryOrder)를 쓰는 차트. 값 크기로 놓는 차트와 gantt 행은 쓰지 않는다. */
export const CATEGORY_ORDER_CHARTS: readonly ChartType[] = [
  "bar",
  "boxplot",
  "waterfall",
  "heatmap",
];

export function supportsOption(type: ChartType, section: OptionSection) {
  return OPTION_SUPPORT[type].includes(section);
}

/** 축마다 쓸 수 있는 선 종류와 구간별(multi)을 쓸 수 있는지 */
export type LimitSupport = {
  left: readonly LimitKind[];
  bottom: readonly LimitKind[];
  /** 구간별 선. left 축에서만 쓴다. */
  multi: boolean;
};

/**
 * 그린 차트에서 관리선을 어떻게 쓸 수 있는지. null이면 구역을 끈다 (선을 검사하지도, 그리지도 않는다).
 * - scatter·line: left는 세 종류와 구간별. bottom은 x가 숫자면 기준선·컬럼 선·띠, 시계열이면 기준선만(값은 ISO 시각).
 * - line 분포 하위 차트(ECDF·NCDF·Probability): 좌표가 컬럼 값이 아니라 끈다.
 * - bar Side: left의 기준선·컬럼 선(item 행 전체 집계 한 줄). Stack·Stack 100: 쌓은 합·비율이라 기준선만.
 * - 그 밖의 차트는 OPTION_SUPPORT에 구역이 없다.
 * xType은 x 컬럼의 타입이다. 모르면(화면이 아직 스키마를 받지 않음) 숫자로 본다.
 */
export function controlLimitSupport(
  spec: Pick<ChartSpec, "chartType" | "subType">,
  xType?: LogicalType,
): LimitSupport | null {
  if (!supportsOption(spec.chartType, "controlLimit")) return null;
  if (spec.chartType === "bar") {
    const sub = subTypeOf(spec);
    return {
      left:
        sub === "stack" || sub === "stack100"
          ? ["reference"]
          : ["reference", "column"],
      bottom: [],
      multi: false,
    };
  }
  if (isDistributionLine(spec)) return null;
  return {
    left: LIMIT_KINDS,
    bottom: xType === "datetime" ? ["reference"] : LIMIT_KINDS,
    multi: true,
  };
}

/** 차트가 쓰지 않는 구역을 뺀 부분 값. 저장 전에 걸러 history·공유 링크에 쓰레기 값이 남지 않게 한다. */
export function pickSupported(
  type: ChartType,
  patch: ChartOptionsPatch | undefined,
): ChartOptionsPatch | undefined {
  if (!patch) return undefined;
  const out: ChartOptionsPatch = {};
  for (const section of OPTION_SUPPORT[type]) {
    if (patch[section] !== undefined)
      (out as Record<string, unknown>)[section] = patch[section];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 전체 기본값 → 테마별 기본값 → 차트 종류별 기본값 → 공통 → item 개별 순으로 합친 전체 옵션. 차트가 쓰지 않는 구역은 기본값이다.
 * 기본값은 화면이 GET /defaults로 받는 것과 같은 CHART_DEFAULTS를 defaultsFor로 합친 값이다.
 */
export function resolveOptions(
  type: ChartType,
  common: ChartOptionsPatch | undefined,
  item: ChartOptionsPatch | undefined,
  theme: ChartTheme = "light",
): ChartOptions {
  return mergeOptions<ChartOptions>(
    mergeOptions<ChartOptions>(
      defaultsFor(type, theme).options,
      pickSupported(type, common),
    ),
    pickSupported(type, item),
  );
}
