// 차트 종류별로 x·y·z에 쓸 수 있는 컬럼 타입과 기능. 새 차트는 여기에 한 줄을 더한다.
// 화면은 @server를 import하지 않으므로 같은 표를 src/entities/chart/model/chart-kinds.ts에 따로 둔다.

import type { ChartType } from "../api/types";
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
  sankey: {
    x: ["categorical"],
    y: ["categorical"],
    z: ["numeric"],
    agg: true,
    legend: false,
    distinctXY: true,
  },
};

/** 점 하나하나를 그려 사각형·자유형 삭제를 할 수 있는 차트 */
export const DELETABLE_CHARTS: readonly ChartType[] = ["scatter"];

/** item이 그린 행을 데이터 표·다운로드로 줄 수 있는 차트 (server/data/item-rows.ts가 행 고르는 규칙을 아는 차트) */
export const ROW_CHARTS = [
  "scatter",
  "bar",
  "boxplot",
] as const satisfies readonly ChartType[];

export function isRowChart(
  type: ChartType,
): type is (typeof ROW_CHARTS)[number] {
  return (ROW_CHARTS as readonly ChartType[]).includes(type);
}
