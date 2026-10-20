import type { ColumnType, RowSize } from "@/shared/api/types";

export const ROW_LABELS: Record<RowSize, string> = {
  100000: "10만 행",
  500000: "50만 행",
  1000000: "100만 행",
};

/** 데이터셋 스키마의 논리 타입 이름표 */
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  categorical: "범주",
  numeric: "숫자",
  datetime: "시계열",
};
