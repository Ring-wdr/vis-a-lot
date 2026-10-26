// 차트 종류별로 쓸 수 있는 속성 구역. 원본 제품의 'Availability of Chart-Specific Options' 표에서
// 이 프로토타입에 있는 14종만 옮기고, 렌더러에 그 개념이 없는 칸은 X로 둔다 (주석에 이유).
// 화면은 @server를 import하지 않으므로 같은 표를 src/entities/chart/model/chart-options.ts에 따로 둔다.

import type { ChartType } from "../api/types";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  mergeOptions,
  OPTION_SECTIONS,
  type OptionSection,
} from "../render/options";
import { defaultsFor } from "./chart-defaults";

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
  boxplot: without("score", "prediction", "tooltip", "expression"),
  histogram: without("score", "prediction", "focus", "expression"),
  pie: without("axes", "score", "prediction", "focus", "expression"),
  gantt: without("score", "prediction", "expression"),
  treemap: without("axes", "score", "prediction", "focus", "expression"),
  heatmap: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  candle: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "value",
    "expression",
  ),
  waterfall: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  funnel: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  radar: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  sankey: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
};

export function supportsOption(type: ChartType, section: OptionSection) {
  return OPTION_SUPPORT[type].includes(section);
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
 * 전체 기본값 → 차트 종류별 기본값 → 공통 → item 개별 순으로 합친 전체 옵션. 차트가 쓰지 않는 구역은 기본값이다.
 * 기본값은 화면이 GET /defaults로 받는 것과 같은 CHART_DEFAULTS를 defaultsFor로 합친 값이다.
 */
export function resolveOptions(
  type: ChartType,
  common: ChartOptionsPatch | undefined,
  item: ChartOptionsPatch | undefined,
): ChartOptions {
  return mergeOptions<ChartOptions>(
    mergeOptions<ChartOptions>(
      defaultsFor(type).options,
      pickSupported(type, common),
    ),
    pickSupported(type, item),
  );
}
