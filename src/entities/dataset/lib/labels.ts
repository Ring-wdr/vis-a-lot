import type { ColumnType } from "@/shared/api/types";

/** 데이터셋 스키마의 논리 타입 이름표 */
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  categorical: "범주",
  numeric: "숫자",
  datetime: "시계열",
};

/** CSV 구분 기호 이름표. 목록에 없는 기호는 그대로 보여준다. */
export const DELIMITER_LABELS: Record<string, string> = {
  ",": "쉼표 (,)",
  "\t": "탭",
  ";": "세미콜론 (;)",
  "|": "세로 막대 (|)",
};

export function delimiterLabel(delimiter: string) {
  return DELIMITER_LABELS[delimiter] ?? delimiter;
}
