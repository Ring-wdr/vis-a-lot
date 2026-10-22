// 차트 종류별 컬럼 역할과 상단 도구 줄에서 쓸 수 있는 기능. 새 차트는 여기에 한 줄씩 더한다.
// 서버의 같은 표(server/charts/chart-fields.ts)와 컬럼 타입이 맞아야 한다.

import type { ChartType, ColumnType } from "@/shared/api/types";

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
};

export const CHART_FIELDS: Record<ChartType, ChartFields> = {
  scatter: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
  bar: { x: ["categorical"], y: ["numeric"], agg: true },
  boxplot: { x: ["categorical"], y: ["numeric"], agg: false },
  line: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
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
};

export function supports(type: ChartType | undefined, feature: ChartFeature) {
  return type !== undefined && CHART_SUPPORT[type].includes(feature);
}
