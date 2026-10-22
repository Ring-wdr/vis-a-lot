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
};

export const CHART_FIELDS: Record<ChartType, ChartFields> = {
  scatter: { x: ["numeric", "datetime"], y: ["numeric"], agg: false },
  bar: { x: ["categorical"], y: ["numeric"], agg: true },
  boxplot: { x: ["categorical"], y: ["numeric"], agg: false },
  line: { x: ["numeric", "datetime"], y: ["numeric"], agg: false },
};

/** 점 하나하나를 그려 사각형·자유형 삭제를 할 수 있는 차트 */
export const DELETABLE_CHARTS: readonly ChartType[] = ["scatter", "line"];

/**
 * 행 하나를 점 하나로 그리는 차트. 같은 원자료(chartData)를 쓰고,
 * 선택·삭제·선택 필드를 점 좌표(x, y)로 판정한다.
 */
export const POINT_CHARTS: readonly ChartType[] = ["scatter", "line"];
