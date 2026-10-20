import type { ChartSpec, ChartType } from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import { columnLabel } from "@/shared/lib/format";

export const CHART_LABELS: Record<ChartType, string> = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
};

/** 'Scatter · 측정 시각 × 측정값'처럼 차트를 한 줄로 부르는 이름 (history 목록, 탭) */
export function chartTitle(spec: ChartSpec) {
  const measure =
    spec.chartType === "bar"
      ? `${AGG_LABELS[spec.agg]}(${columnLabel(spec.y)})`
      : columnLabel(spec.y);
  return `${CHART_LABELS[spec.chartType]} · ${columnLabel(spec.x)} × ${measure}`;
}
