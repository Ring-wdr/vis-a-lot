import type { ChartSpec, ChartType } from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import type { ColumnLookup } from "@/shared/lib/format";

export const CHART_LABELS: Record<ChartType, string> = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
};

/**
 * 'Scatter · 측정 시각 × 측정값'처럼 차트를 한 줄로 부르는 이름 (history 목록, 탭).
 * 컬럼 라벨은 그 차트 데이터셋의 스키마(columns)에서 찾는다.
 */
export function chartTitle(spec: ChartSpec, columns: ColumnLookup) {
  const measure =
    spec.chartType === "bar"
      ? `${AGG_LABELS[spec.agg]}(${columns.label(spec.y)})`
      : columns.label(spec.y);
  return `${CHART_LABELS[spec.chartType]} · ${columns.label(spec.x)} × ${measure}`;
}
