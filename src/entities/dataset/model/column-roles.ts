// 데이터셋 스키마로 컬럼의 쓰임을 정한다. 컬럼 이름은 데이터마다 다르므로 타입만 보고 고른다.

import type {
  ChartFilter,
  ChartSpec,
  ChartType,
  ColumnInfo,
} from "@/shared/api/types";

/** legend 팔레트는 8색이라 값이 그보다 많은 범주 컬럼은 legend로 쓰지 않는다. */
export const LEGEND_MAX_VALUES = 8;

/** x축 후보: scatter는 시각·숫자(시각 먼저), bar/boxplot은 범주 */
export function axisColumns(
  columns: readonly ColumnInfo[],
  chartType: ChartType,
) {
  if (chartType !== "scatter")
    return columns.filter((c) => c.type === "categorical");
  return [
    ...columns.filter((c) => c.type === "datetime"),
    ...columns.filter((c) => c.type === "numeric"),
  ];
}

export function numericColumns(columns: readonly ColumnInfo[]) {
  return columns.filter((c) => c.type === "numeric");
}

/** 범주이면서 값이 8개 이하. 고유값 수는 적재가 끝나야 알 수 있어 그 전에는 비어 있다. */
export function legendColumns(columns: readonly ColumnInfo[]) {
  return columns.filter(
    (c) =>
      c.type === "categorical" &&
      c.distinct !== null &&
      c.distinct <= LEGEND_MAX_VALUES,
  );
}

function filterFits(filter: ChartFilter, byName: Map<string, ColumnInfo>) {
  const column = byName.get(filter.column);
  if (!column) return false;
  return filter.kind === "range"
    ? column.type !== "categorical"
    : column.type === "categorical";
}

/**
 * 스키마에 맞지 않는 설정을 바로잡는다. 다른 데이터셋으로 바꿨거나 처음 스키마를 받았을 때 쓴다.
 * 바꿀 것이 없으면 undefined.
 */
export function fitSpecToSchema(
  spec: ChartSpec,
  columns: readonly ColumnInfo[],
): Partial<ChartSpec> | undefined {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const patch: Partial<ChartSpec> = {};

  const axis = axisColumns(columns, spec.chartType);
  const x = axis.some((c) => c.name === spec.x)
    ? spec.x
    : (axis[0]?.name ?? "");
  if (x !== spec.x) patch.x = x;

  const numeric = numericColumns(columns);
  if (!numeric.some((c) => c.name === spec.y)) {
    patch.y = (numeric.find((c) => c.name !== x) ?? numeric[0])?.name ?? "";
  }

  // 고유값 수를 아직 모르면(적재 중) 범주이기만 하면 두고, 알게 되면 8개 이하인지 본다.
  const legend = spec.legend === null ? undefined : byName.get(spec.legend);
  const legendOk =
    legend?.type === "categorical" &&
    (legend.distinct === null || legend.distinct <= LEGEND_MAX_VALUES);
  if (spec.legend !== null && !legendOk) patch.legend = null;

  const splitBy = spec.splitBy.filter((c) => byName.has(c));
  if (splitBy.length !== spec.splitBy.length) patch.splitBy = splitBy;
  const tooltip = spec.tooltip.filter((c) => byName.has(c));
  if (tooltip.length !== spec.tooltip.length) patch.tooltip = tooltip;
  const filters = spec.filters?.filter((f) => filterFits(f, byName));
  if (filters && filters.length !== spec.filters?.length)
    patch.filters = filters;

  return Object.keys(patch).length > 0 ? patch : undefined;
}
