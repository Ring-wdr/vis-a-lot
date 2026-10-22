import type { ColumnType, CsvEncoding } from "@/shared/api/types";

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

export const ENCODING_LABELS: Record<CsvEncoding, string> = {
  auto: "자동 (UTF-8, 깨지면 EUC-KR)",
  "utf-8": "UTF-8",
  "euc-kr": "EUC-KR (CP949)",
};

/** 고를 수 있는 날짜 시간 형식. 서버가 읽는 토큰: yyyy yy MM M dd d HH H mm m ss s SSS */
export const DATETIME_FORMATS = [
  "yyyy-MM-dd HH:mm:ss.SSS",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd",
  "yyyy/MM/dd HH:mm:ss",
  "yyyy/MM/dd",
  "yyyy.MM.dd HH:mm:ss",
  "yyyy.MM.dd",
  "MM/dd/yyyy HH:mm:ss",
  "MM/dd/yyyy",
  "dd.MM.yyyy HH:mm:ss",
  "dd.MM.yyyy",
  "yyyyMMddHHmmss",
  "yyyyMMdd",
] as const;

/** 지운 데이터를 고른 채로 남은 화면에 보여주는 안내 */
export const DELETED_DATASET_HINT =
  "삭제된 데이터입니다. datastore에서 다른 데이터를 고르세요.";
