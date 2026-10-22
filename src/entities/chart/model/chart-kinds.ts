// 차트 종류별 컬럼 역할과 상단 도구 줄에서 쓸 수 있는 기능. 새 차트는 여기에 한 줄씩 더한다.
// 서버의 같은 표(server/charts/chart-fields.ts)와 컬럼 타입이 맞아야 한다.

import type { ChartSpec, ChartType, ColumnType } from "@/shared/api/types";

export type ChartFields = {
  x: readonly ColumnType[];
  /** null이면 y를 쓰지 않아 고르지 않는다 */
  y: readonly ColumnType[] | null;
  /** 세 번째 값 컬럼. 없으면 고르지 않는다 */
  z?: readonly ColumnType[];
  /** 왼쪽 패널의 컬럼 라벨. 없으면 x, y, z */
  labels?: Partial<Record<"x" | "y" | "z", string>>;
  /** 통계 함수(spec.agg)를 고르는지 */
  agg: boolean;
  /** false면 legend 컬럼을 고르지 않는다. 차트가 정한 값(예: sankey 출발 노드)으로 legend를 그린다. */
  legend?: false;
};

export const CHART_FIELDS: Record<ChartType, ChartFields> = {
  scatter: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
  bar: { x: ["categorical"], y: ["numeric"], agg: true },
  boxplot: { x: ["categorical"], y: ["numeric"], agg: false },
  line: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
  sankey: {
    x: ["categorical"],
    y: ["categorical"],
    z: ["numeric"],
    labels: { x: "출발 (x)", y: "도착 (y)", z: "흐름 값 (z)" },
    agg: true,
    legend: false,
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
  gantt: {
    x: ["datetime"],
    y: ["categorical"],
    labels: { y: "y (작업 행)" },
    agg: false,
  },
  pie: { x: ["categorical"], y: ["numeric"], agg: true, legend: false },
};

/**
 * 상단 도구 줄 기능. 모드(이동·확대·선택·삭제·페인트)와 차트 도구(선택 필드 = 데이터 다운로드·데이터 테이블,
 * 체크박스 표시)를 차트 종류마다 켜고 끈다.
 */
export const CHART_FEATURES = [
  "pan",
  "zoom",
  "select",
  "selectField",
  "delete",
  "paint",
  "checkbox",
] as const;
export type ChartFeature = (typeof CHART_FEATURES)[number];

const ALL = CHART_FEATURES;
const NO_DELETE = CHART_FEATURES.filter((f) => f !== "delete");

export const CHART_SUPPORT: Record<ChartType, readonly ChartFeature[]> = {
  scatter: ALL,
  bar: NO_DELETE,
  boxplot: NO_DELETE,
  line: ALL,
  sankey: ["select", "checkbox"],
  heatmap: ["pan", "zoom", "select", "paint"],
  treemap: ["pan", "zoom", "select", "checkbox"],
  candle: ["pan", "zoom", "select", "paint", "checkbox"],
  gantt: ["pan", "zoom", "select", "paint", "checkbox"],
  // 이동·확대가 없는 고정 좌표 차트: 선택(조각 중심점)과 체크박스(조각 숨기기)만
  pie: ["select", "checkbox"],
};

/** 그릴 때 쓰는 legend 컬럼. legend 컬럼을 쓰지 않는 차트면 고른 값이 남아 있어도 null */
export function legendColumnOf(spec: Pick<ChartSpec, "chartType" | "legend">) {
  return CHART_FIELDS[spec.chartType].legend === false ? null : spec.legend;
}

/** PNG에 legend를 그리는지. legend 컬럼을 쓰지 않는 차트는 차트가 정한 값으로 늘 그린다. */
export function drawsLegend(spec: Pick<ChartSpec, "chartType" | "legend">) {
  return CHART_FIELDS[spec.chartType].legend === false || spec.legend !== null;
}

export function supports(type: ChartType | undefined, feature: ChartFeature) {
  return type !== undefined && CHART_SUPPORT[type].includes(feature);
}
