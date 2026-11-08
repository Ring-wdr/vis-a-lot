import type {
  ChartFilter,
  ColumnName,
  ColumnSummary,
  RangeFilter,
} from "@/shared/api/types";

export function filterOf(
  filters: readonly ChartFilter[] | undefined,
  column: ColumnName,
) {
  return filters?.find((f) => f.column === column);
}

/** 컬럼 하나의 필터를 바꾼다. undefined면 그 컬럼 필터를 없앤다. 컬럼 순서는 유지한다. */
export function withFilter(
  filters: readonly ChartFilter[] | undefined,
  column: ColumnName,
  next: ChartFilter | undefined,
): ChartFilter[] {
  const rest = (filters ?? []).filter((f) => f.column !== column);
  return next ? [...rest, next] : rest;
}

type RangeSummary = Extract<ColumnSummary, { kind: "range" }>;

/**
 * 범위 필터를 만든다. 전체 범위 그대로이고 반전·null 제외도 없으면 거르는 게 없으므로 필터를 두지 않는다.
 */
export function rangeFilter(
  summary: RangeSummary,
  range: [number, number],
  inverse: boolean,
  includeNull: boolean,
): RangeFilter | undefined {
  const full =
    summary.min !== null &&
    summary.max !== null &&
    range[0] <= summary.min &&
    range[1] >= summary.max;
  if (full && !inverse && includeNull) return undefined;
  return {
    kind: "range",
    column: summary.column,
    min: range[0],
    max: range[1],
    inverse,
    includeNull,
  };
}

/** 두 필터 목록이 같은 조건인지 (draw에 아직 반영되지 않은 변경 표시용) */
export function sameFilters(
  a: readonly ChartFilter[] | undefined,
  b: readonly ChartFilter[] | undefined,
) {
  const key = (fs: readonly ChartFilter[] | undefined) =>
    JSON.stringify(
      [...(fs ?? [])]
        .sort((x, y) => x.column.localeCompare(y.column))
        .map((f) =>
          f.kind === "exclude" ? { ...f, values: [...f.values].sort() } : f,
        ),
    );
  return key(a) === key(b);
}
