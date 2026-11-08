"use client";

import { useId } from "react";
import {
  DATETIME_FORMATS,
  useDatasetLabels,
} from "@/entities/dataset/lib/labels";
import type { CsvEncoding, CsvOptions } from "@/shared/api/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";

const option = "flex min-w-0 flex-col gap-1 text-ui";
const optionLabel = "p-0 font-medium text-xs text-fg-secondary";
const input =
  "min-w-0 rounded-md border border-line bg-elevated px-2 py-1 text-ui";
const hint = "m-0 text-2xs text-fg-muted leading-normal";
const seg = segmented();

const messages = defineMessages({
  ko: {
    yes: "예",
    no: "아니오",
    name: "이름",
    namePlaceholder: "파일 이름",
    delimiter: "구분 기호",
    custom: "직접 입력",
    customDelimiter: "구분 기호 직접 입력",
    oneChar: "한 글자",
    header: "첫 번째 행 헤더",
    nullValue: "Null 값",
    emptyValue: "(빈 값)",
    quote: "따옴표",
    datetimeFormat: "날짜 시간 형식",
    autoIso: "자동 (ISO 8601)",
    customDatetimeFormat: "날짜 시간 형식 직접 입력",
    datetimeHint:
      "yyyy·MM·dd·HH·mm·ss·SSS. 이 형식으로 읽히는 컬럼을 시계열로 봅니다.",
    ignoreErrors: "데이터 오류 무시",
    ignoreErrorsHint:
      "켜면 타입으로 바꿀 수 없는 값은 null로, 필드 수가 맞지 않는 행은 건너뜁니다.",
    encoding: "인코딩",
  },
  en: {
    yes: "Yes",
    no: "No",
    name: "Name",
    namePlaceholder: "File name",
    delimiter: "Delimiter",
    custom: "Custom",
    customDelimiter: "Custom delimiter",
    oneChar: "One char",
    header: "First row is header",
    nullValue: "Null value",
    emptyValue: "(empty)",
    quote: "Quote",
    datetimeFormat: "Date/time format",
    autoIso: "Auto (ISO 8601)",
    customDatetimeFormat: "Custom date/time format",
    datetimeHint:
      "yyyy·MM·dd·HH·mm·ss·SSS. Columns that parse in this format become time.",
    ignoreErrors: "Ignore data errors",
    ignoreErrorsHint:
      "When on, values that can't be converted become null and rows with the wrong field count are skipped.",
    encoding: "Encoding",
  },
});

const CUSTOM = "custom";
const ISO = "iso";

export const DEFAULT_CSV_OPTIONS: CsvOptions = {
  delimiter: ",",
  header: true,
  nullValue: "",
  quote: '"',
  encoding: "auto",
  datetimeFormat: null,
  ignoreErrors: false,
};

/** 예/아니오 두 버튼 */
function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const text = useT(messages);
  return (
    <fieldset className={option}>
      <legend className={optionLabel}>{label}</legend>
      <div className={seg.root()}>
        <button
          type="button"
          className={seg.item()}
          aria-pressed={value}
          onClick={() => onChange(true)}
        >
          {text.yes}
        </button>
        <button
          type="button"
          className={seg.item()}
          aria-pressed={!value}
          onClick={() => onChange(false)}
        >
          {text.no}
        </button>
      </div>
    </fieldset>
  );
}

/**
 * 업로드 팝업 오른쪽의 전처리 옵션: 이름, 구분 기호, 헤더, Null 값, 따옴표, 날짜 시간 형식,
 * 데이터 오류 무시, 인코딩. 컬럼별 포함·타입은 아래 미리보기 표 머리에서 정한다.
 */
export function UploadOptions({
  name,
  onNameChange,
  value,
  onChange,
}: {
  name: string;
  onNameChange: (next: string) => void;
  value: CsvOptions;
  onChange: (next: CsvOptions) => void;
}) {
  const id = useId();
  const text = useT(messages);
  const labels = useDatasetLabels();
  const knownDelimiter = value.delimiter in labels.delimiters;
  const format = value.datetimeFormat;
  const knownFormat =
    format === null || (DATETIME_FORMATS as readonly string[]).includes(format);
  const set = (patch: Partial<CsvOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className={option}>
        <label className={optionLabel} htmlFor={`${id}-name`}>
          {text.name}
        </label>
        <input
          id={`${id}-name`}
          className={input}
          value={name}
          maxLength={100}
          placeholder={text.namePlaceholder}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className={option}>
        <Select
          label={text.delimiter}
          value={knownDelimiter ? value.delimiter : CUSTOM}
          options={[
            ...Object.entries(labels.delimiters).map(([d, label]) => ({
              value: d,
              label,
            })),
            { value: CUSTOM, label: text.custom },
          ]}
          onChange={(next) => set({ delimiter: next === CUSTOM ? "" : next })}
        />
        {!knownDelimiter && (
          <input
            aria-label={text.customDelimiter}
            className={input}
            value={value.delimiter}
            maxLength={1}
            placeholder={text.oneChar}
            onChange={(e) => set({ delimiter: e.target.value })}
          />
        )}
      </div>

      <YesNo
        label={text.header}
        value={value.header}
        onChange={(header) => set({ header })}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <div className={option}>
          <label className={optionLabel} htmlFor={`${id}-null`}>
            {text.nullValue}
          </label>
          <input
            id={`${id}-null`}
            className={input}
            value={value.nullValue}
            maxLength={20}
            placeholder={text.emptyValue}
            onChange={(e) => set({ nullValue: e.target.value })}
          />
        </div>
        <div className={option}>
          <label className={optionLabel} htmlFor={`${id}-quote`}>
            {text.quote}
          </label>
          <input
            id={`${id}-quote`}
            className={input}
            value={value.quote}
            maxLength={1}
            placeholder={text.oneChar}
            onChange={(e) => set({ quote: e.target.value })}
          />
        </div>
      </div>

      <div className={option}>
        <Select
          label={text.datetimeFormat}
          value={format === null ? ISO : knownFormat ? format : CUSTOM}
          options={[
            { value: ISO, label: text.autoIso },
            ...DATETIME_FORMATS.map((f) => ({ value: f, label: f })),
            { value: CUSTOM, label: text.custom },
          ]}
          onChange={(next) =>
            set({
              datetimeFormat:
                next === ISO ? null : next === CUSTOM ? "yyyy-MM-dd" : next,
            })
          }
        />
        {!knownFormat && (
          <input
            aria-label={text.customDatetimeFormat}
            className={input}
            value={format ?? ""}
            maxLength={40}
            placeholder="yyyy-MM-dd HH:mm:ss"
            onChange={(e) => set({ datetimeFormat: e.target.value || null })}
          />
        )}
        <p className={hint}>{text.datetimeHint}</p>
      </div>

      <YesNo
        label={text.ignoreErrors}
        value={value.ignoreErrors}
        onChange={(ignoreErrors) => set({ ignoreErrors })}
      />
      <p className={hint}>{text.ignoreErrorsHint}</p>

      <div className={option}>
        <Select
          label={text.encoding}
          value={value.encoding}
          options={(
            Object.entries(labels.encodings) as [CsvEncoding, string][]
          ).map(([v, label]) => ({ value: v, label }))}
          onChange={(encoding) => set({ encoding })}
        />
      </div>
    </div>
  );
}
