"use client";

import { MAX_ORDER_VALUES } from "@/entities/chart/model/chart-options";
import { useColumnSummary, useLegendValues } from "@/shared/api/queries";
import type { ColumnName, DatasetId } from "@/shared/api/types";

/** 순서 필드가 늘어놓을 값 목록. 받는 중이면 values가 없다. */
export type OrderValues = {
  values: string[] | undefined;
  /** 고유값이 MAX_ORDER_VALUES를 넘어 순서를 정할 수 없다 (정렬만 고른다). */
  tooMany: boolean;
  loading: boolean;
};

/**
 * 순서 필드(legend 순서·범주 순서)의 값 목록. legend는 legend-values API, 범주는 컬럼 요약(값별 개수)에서 받는다.
 * column이 없으면(legend 컬럼을 고르지 않음) 받지 않는다. 데이터셋이 준비된 뒤에만 받는다(ready).
 */
export function useOrderValues({
  kind,
  dataset,
  column,
  ready = true,
}: {
  kind: "legend" | "category";
  dataset: DatasetId;
  column: ColumnName | null;
  ready?: boolean;
}): OrderValues {
  const legend = useLegendValues(
    dataset,
    kind === "legend" ? column : null,
    ready,
  );
  const summary = useColumnSummary(
    dataset,
    column ?? ("" as ColumnName),
    ready && kind === "category" && column !== null,
  );
  if (kind === "legend") {
    const values = legend.data?.values;
    return {
      values,
      tooMany: (values?.length ?? 0) > MAX_ORDER_VALUES,
      loading: legend.isLoading,
    };
  }
  const data = summary.data;
  const values =
    data?.kind === "values" ? data.values.map((v) => v.value) : undefined;
  return {
    values,
    tooMany: (values?.length ?? 0) > MAX_ORDER_VALUES,
    loading: summary.isLoading,
  };
}
