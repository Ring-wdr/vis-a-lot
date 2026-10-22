// 차트 종류별로 x·y·z에 쓸 수 있는 컬럼 타입과 기능. 새 차트는 여기에 한 줄을 더한다.
// 화면은 @server를 import하지 않으므로 같은 표를 src/entities/chart/model/chart-kinds.ts에 따로 둔다.

import type { ChartSpec, ChartType } from "../api/types";
import type { LogicalType } from "../data/dataset-schema";
import type { LegendPosition } from "../render/legend";

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
  /** 공통·개별 속성에 legend 위치가 없을 때의 위치. 없으면 위 (funnel은 단계 이름이 길어 오른쪽 세로 목록) */
  legendPosition?: LegendPosition;
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
    legendPosition: "right",
  },
};

/** 그릴 때 쓰는 legend 컬럼. legend 컬럼을 쓰지 않는 차트면 spec에 남은 값이 있어도 null (화면 chart-kinds와 같다) */
export function legendColumnOf(spec: Pick<ChartSpec, "chartType" | "legend">) {
  return CHART_FIELDS[spec.chartType].legend === false ? null : spec.legend;
}

/** 점 하나하나를 그려 사각형·자유형 삭제를 할 수 있는 차트 */
export const DELETABLE_CHARTS: readonly ChartType[] = ["scatter", "line"];

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

export function filtersRowsBySelection(
  type: ChartType,
): type is (typeof SELECTION_ROW_CHARTS)[number] {
  return (SELECTION_ROW_CHARTS as readonly ChartType[]).includes(type);
}
