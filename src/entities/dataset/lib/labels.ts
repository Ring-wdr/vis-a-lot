import type { RowSize } from "@server/data/schema";

export const ROW_LABELS: Record<RowSize, string> = {
  100000: "10만 행",
  500000: "50만 행",
  1000000: "100만 행",
};

export const COLUMN_TYPE_LABELS = {
  time: "시계열",
  string: "문자",
  number: "숫자",
} as const;
