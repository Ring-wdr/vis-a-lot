// 차트 종류별로 x·y·z에 쓸 수 있는 컬럼 타입과 기능. 새 차트는 여기에 한 줄을 더한다.
// 화면은 @server를 import하지 않으므로 같은 표를 src/shared/config/chart-kinds.ts에 따로 둔다.

import type { ChartSpec, ChartSubType, ChartType } from "../api/types";
import type { LogicalType } from "../data/dataset-schema";

export type ChartFields = {
  x: readonly LogicalType[];
  /** null이면 y를 쓰지 않는다 (예: histogram은 x 하나의 분포) */
  y: readonly LogicalType[] | null;
  /** 세 번째 컬럼 (색·굵기 등 값). 없으면 쓰지 않는다. */
  z?: readonly LogicalType[];
  /** 통계 함수(spec.agg)를 쓰는지 */
  agg: boolean;
  /** false면 legend 컬럼(spec.legend)을 쓰지 않는다. 차트가 정한 값(예: sankey 출발 노드)으로 legend를 그린다. */
  legend?: false;
  /** x와 y가 서로 다른 컬럼이어야 하는지 (예: sankey 출발 ≠ 도착) */
  distinctXY?: true;
};

export const CHART_FIELDS: Record<ChartType, ChartFields> = {
  scatter: { x: ["numeric", "datetime"], y: ["numeric"], agg: false },
  bar: { x: ["categorical"], y: ["numeric"], agg: true },
  boxplot: { x: ["categorical"], y: ["numeric"], agg: false },
  line: { x: ["numeric", "datetime"], y: ["numeric"], agg: false },
  sankey: {
    x: ["categorical"],
    y: ["categorical"],
    z: ["numeric"],
    agg: true,
    legend: false,
    distinctXY: true,
  },
  heatmap: {
    x: ["categorical", "datetime"],
    y: ["categorical"],
    z: ["numeric"],
    agg: true,
    legend: false,
  },
  treemap: { x: ["categorical"], y: ["numeric"], agg: true },
  candle: { x: ["datetime"], y: ["numeric"], agg: false, legend: false },
  gantt: { x: ["datetime"], y: ["categorical"], agg: false },
  pie: { x: ["categorical"], y: ["numeric"], agg: true, legend: false },
  radar: { x: ["categorical"], y: ["numeric"], agg: true },
  histogram: { x: ["numeric"], y: null, agg: false },
  // 막대 종류(증가·감소·합계)가 곧 legend다.
  waterfall: {
    x: ["categorical"],
    y: ["numeric"],
    agg: true,
    legend: false,
  },
  // 단계(값 큰 순으로 줄 세운 범주)가 곧 legend다.
  funnel: {
    x: ["categorical"],
    y: ["numeric"],
    agg: true,
    legend: false,
  },
};

/**
 * 차트별 하위 차트. 첫 값이 기본이다. 없는 차트는 하위 차트가 없다. 화면 chart-kinds의 같은 표와 맞춘다.
 */
export const SUB_TYPES: Partial<Record<ChartType, readonly ChartSubType[]>> = {
  line: ["none", "ecdf", "ncdf", "probability"],
  bar: ["side", "stack", "stack100"],
  boxplot: ["none", "dot"],
  pie: ["none", "doughnut", "pie3d", "sunburst"],
};

/** 그릴 하위 차트. 없거나 그 차트에 없는 값(예전 history, 다른 차트에서 남은 값)이면 기본값, 하위 차트가 없는 차트면 undefined */
export function subTypeOf(
  spec: Pick<ChartSpec, "chartType" | "subType">,
): ChartSubType | undefined {
  const list = SUB_TYPES[spec.chartType];
  if (!list) return undefined;
  return spec.subType && list.includes(spec.subType) ? spec.subType : list[0];
}

/** line의 분포 하위 차트(ECDF·정규 CDF·정규 확률). y 컬럼 값의 분포를 그려 점 좌표가 원래 컬럼 값이 아니다. */
export function isDistributionLine(
  spec: Pick<ChartSpec, "chartType" | "subType">,
) {
  const sub = subTypeOf(spec);
  return (
    spec.chartType === "line" &&
    (sub === "ecdf" || sub === "ncdf" || sub === "probability")
  );
}

/**
 * 그릴 때 쓰는 legend 컬럼. legend 컬럼을 쓰지 않는 차트면 spec에 남은 값이 있어도 null (화면 chart-kinds와 같다).
 * pie sunburst는 legend 컬럼을 바깥 고리로 쓴다.
 */
export function legendColumnOf(
  spec: Pick<ChartSpec, "chartType" | "legend" | "subType">,
) {
  if (spec.chartType === "pie" && subTypeOf(spec) === "sunburst")
    return spec.legend;
  return CHART_FIELDS[spec.chartType].legend === false ? null : spec.legend;
}

/** 점 하나하나를 그려 사각형·자유형 삭제를 할 수 있는 차트 */
export const DELETABLE_CHARTS: readonly ChartType[] = ["scatter", "line"];

/** 사각형·자유형 삭제를 할 수 있는지. 분포 line은 점 좌표가 컬럼 값이 아니라 지운 영역을 행으로 옮길 수 없다. */
export function canDelete(spec: Pick<ChartSpec, "chartType" | "subType">) {
  return DELETABLE_CHARTS.includes(spec.chartType) && !isDistributionLine(spec);
}

/**
 * 행 하나를 점 하나로 그리는 차트. 같은 원자료(chartData)를 쓰고,
 * 선택·삭제·선택 필드를 점 좌표(x, y)로 판정한다.
 */
export const POINT_CHARTS: readonly ChartType[] = ["scatter", "line"];

/**
 * 선택 영역으로 데이터 표·다운로드의 행을 거르는 차트 (기능 표의 '선택 필드').
 * server/data/item-rows.ts가 선택 영역 → 행 규칙을 아는 차트다. 나머지는 item 전체 행을 준다.
 */
export const SELECTION_ROW_CHARTS = [
  "scatter",
  "bar",
  "boxplot",
  "line",
  "histogram",
  "waterfall",
] as const satisfies readonly ChartType[];

/** 분포 line은 점 좌표가 컬럼 값이 아니라 선택 영역으로 행을 거를 수 없다. */
export function filtersRowsBySelection(
  spec: Pick<ChartSpec, "chartType" | "subType">,
) {
  return (
    (SELECTION_ROW_CHARTS as readonly ChartType[]).includes(spec.chartType) &&
    !isDistributionLine(spec)
  );
}
