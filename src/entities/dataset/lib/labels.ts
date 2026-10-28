import type { ColumnType, CsvEncoding } from "@/shared/api/types";
import { defineMessages, t, useT } from "@/shared/lib/i18n";

const messages = defineMessages({
  ko: {
    columnTypes: {
      categorical: "범주",
      numeric: "숫자",
      datetime: "시계열",
    } as Record<ColumnType, string>,
    delimiters: {
      ",": "쉼표 (,)",
      "\t": "탭",
      ";": "세미콜론 (;)",
      "|": "세로 막대 (|)",
    } as Record<string, string>,
    encodings: {
      auto: "자동 (UTF-8, 깨지면 EUC-KR)",
      "utf-8": "UTF-8",
      "euc-kr": "EUC-KR (CP949)",
    } as Record<CsvEncoding, string>,
    deletedDataset:
      "삭제된 데이터입니다. datastore에서 다른 데이터를 고르세요.",
  },
  en: {
    columnTypes: {
      categorical: "Category",
      numeric: "Number",
      datetime: "Time",
    },
    delimiters: {
      ",": "Comma (,)",
      "\t": "Tab",
      ";": "Semicolon (;)",
      "|": "Pipe (|)",
    },
    encodings: {
      auto: "Auto (UTF-8, else EUC-KR)",
      "utf-8": "UTF-8",
      "euc-kr": "EUC-KR (CP949)",
    },
    deletedDataset: "This data was deleted. Pick other data in datastore.",
  },
});

/**
 * 데이터셋 이름표 (스키마 타입, CSV 구분 기호, 인코딩, 지운 데이터 안내). 지금 언어의 표다.
 * 컴포넌트는 useDatasetLabels로 읽어 언어가 바뀌면 다시 그린다.
 */
export function datasetLabels() {
  return t(messages);
}

export function useDatasetLabels() {
  return useT(messages);
}

/** CSV 구분 기호 이름. 목록에 없는 기호는 그대로 보여준다. */
export function delimiterLabel(delimiter: string) {
  return t(messages).delimiters[delimiter] ?? delimiter;
}

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
