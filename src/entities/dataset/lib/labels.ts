// 데이터셋 이름표. 문구는 Lingui msg 설명자로 두고, 언어마다 한 번 번역해 표로 만든다 (영어는 config/locales/en.po).

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { ColumnType, CsvEncoding } from "@/shared/api/types";
import {
  getLocale,
  type Locale,
  linguiFor,
  useLocale,
} from "@/shared/lib/i18n";
import "../config/messages";

const COLUMN_TYPES: Record<ColumnType, MessageDescriptor> = {
  categorical: msg({ message: "범주", context: "column type" }),
  numeric: msg({ message: "숫자", context: "column type" }),
  datetime: msg({ message: "시계열", context: "column type" }),
};

const DELIMITERS: Record<string, MessageDescriptor> = {
  ",": msg`쉼표 (,)`,
  "\t": msg({ message: "탭", context: "CSV delimiter" }),
  ";": msg`세미콜론 (;)`,
  "|": msg`세로 막대 (|)`,
};

const ENCODINGS: Record<CsvEncoding, MessageDescriptor> = {
  auto: msg`자동 (UTF-8, 깨지면 EUC-KR)`,
  "utf-8": msg({ message: "UTF-8", context: "CSV encoding" }),
  "euc-kr": msg({ message: "EUC-KR (CP949)", context: "CSV encoding" }),
};

const DELETED_DATASET = msg`삭제된 데이터입니다. datastore에서 다른 데이터를 고르세요.`;

type Labels = {
  columnTypes: Record<ColumnType, string>;
  delimiters: Record<string, string>;
  encodings: Record<CsvEncoding, string>;
  deletedDataset: string;
};

/** 언어마다 한 번 번역한 표 */
const translated = new Map<Locale, Labels>();
function labels(locale: Locale): Labels {
  let value = translated.get(locale);
  if (!value) {
    const i18n = linguiFor(locale);
    const tr = <K extends string>(table: Record<K, MessageDescriptor>) =>
      Object.fromEntries(
        Object.entries<MessageDescriptor>(table).map(([k, d]) => [
          k,
          i18n._(d),
        ]),
      ) as Record<K, string>;
    value = {
      columnTypes: tr(COLUMN_TYPES),
      delimiters: tr(DELIMITERS),
      encodings: tr(ENCODINGS),
      deletedDataset: i18n._(DELETED_DATASET),
    };
    translated.set(locale, value);
  }
  return value;
}

/**
 * 데이터셋 이름표 (스키마 타입, CSV 구분 기호, 인코딩, 지운 데이터 안내). 지금 언어의 표다.
 * 컴포넌트는 useDatasetLabels로 읽어 언어가 바뀌면 다시 그린다.
 */
export function datasetLabels() {
  return labels(getLocale());
}

export function useDatasetLabels() {
  return labels(useLocale());
}

/** CSV 구분 기호 이름. 목록에 없는 기호는 그대로 보여준다. */
export function delimiterLabel(delimiter: string) {
  return datasetLabels().delimiters[delimiter] ?? delimiter;
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
