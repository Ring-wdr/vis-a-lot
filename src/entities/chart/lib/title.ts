import {
  CHART_FIELDS,
  isDistributionLine,
  SUB_TYPE_LABELS,
  SUB_TYPES,
  subTypeOf,
} from "@/entities/chart/model/chart-kinds";
import type { ChartSpec, ChartType } from "@/shared/api/types";
import { AGG_LABELS } from "@/shared/config/dataset";
import type { ColumnLookup } from "@/shared/lib/format";

export const CHART_LABELS: Record<ChartType, string> = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
  line: "Line",
  sankey: "Sankey",
  heatmap: "Heatmap",
  treemap: "Treemap",
  candle: "Candle",
  gantt: "Gantt",
  pie: "Pie",
  radar: "Radar",
  histogram: "Histogram",
  waterfall: "Waterfall",
  funnel: "Funnel",
};

/** 차트 종류 이름. 기본이 아닌 하위 차트면 붙인다 ('Bar Stack 100'). */
export function chartKindLabel(spec: Pick<ChartSpec, "chartType" | "subType">) {
  const sub = subTypeOf(spec);
  const label = CHART_LABELS[spec.chartType];
  return sub && sub !== SUB_TYPES[spec.chartType]?.[0]
    ? `${label} ${SUB_TYPE_LABELS[sub]}`
    : label;
}

/**
 * 'Scatter · 측정 시각 × 측정값'처럼 차트를 한 줄로 부르는 이름 (history 목록, 탭).
 * 컬럼 라벨은 그 차트 데이터셋의 스키마(columns)에서 찾는다.
 */
export function chartTitle(spec: ChartSpec, columns: ColumnLookup) {
  const fields = CHART_FIELDS[spec.chartType];
  // 통계 함수는 값 컬럼(z가 있으면 z, 없으면 y)에 붙인다.
  const value = fields.z ? spec.z : fields.y ? spec.y : undefined;
  const measure =
    value &&
    (fields.agg
      ? `${AGG_LABELS[spec.agg]}(${columns.label(value)})`
      : columns.label(value));
  // 분포 line은 y 컬럼 하나의 분포다.
  if (isDistributionLine(spec))
    return `${chartKindLabel(spec)} · ${columns.label(spec.y)}`;
  const axes = [
    columns.label(spec.x),
    ...(fields.z && fields.y ? [columns.label(spec.y)] : []),
    ...(measure ? [measure] : []),
  ];
  return `${chartKindLabel(spec)} · ${axes.join(" × ")}`;
}
