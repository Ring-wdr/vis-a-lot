"use client";

import { useId } from "react";
import {
  DATETIME_FORMATS,
  DELIMITER_LABELS,
  ENCODING_LABELS,
} from "@/entities/dataset/lib/labels";
import type { CsvEncoding, CsvOptions } from "@/shared/api/types";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";

const option = "flex min-w-0 flex-col gap-1 text-13";
const optionLabel = "p-0 font-medium text-12 text-fg-secondary";
const input =
  "min-w-0 rounded-md border border-line bg-elevated px-2 py-1.25 text-13 leading-[inherit]";
const hint = "m-0 text-11 text-fg-muted leading-normal";
const seg = segmented();

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
          예
        </button>
        <button
          type="button"
          className={seg.item()}
          aria-pressed={!value}
          onClick={() => onChange(false)}
        >
          아니오
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
  const knownDelimiter = value.delimiter in DELIMITER_LABELS;
  const format = value.datetimeFormat;
  const knownFormat =
    format === null || (DATETIME_FORMATS as readonly string[]).includes(format);
  const set = (patch: Partial<CsvOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className={option}>
        <label className={optionLabel} htmlFor={`${id}-name`}>
          이름
        </label>
        <input
          id={`${id}-name`}
          className={input}
          value={name}
          maxLength={100}
          placeholder="파일 이름"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className={option}>
        <Select
          label="구분 기호"
          value={knownDelimiter ? value.delimiter : CUSTOM}
          options={[
            ...Object.entries(DELIMITER_LABELS).map(([d, label]) => ({
              value: d,
              label,
            })),
            { value: CUSTOM, label: "직접 입력" },
          ]}
          onChange={(next) => set({ delimiter: next === CUSTOM ? "" : next })}
        />
        {!knownDelimiter && (
          <input
            aria-label="구분 기호 직접 입력"
            className={input}
            value={value.delimiter}
            maxLength={1}
            placeholder="한 글자"
            onChange={(e) => set({ delimiter: e.target.value })}
          />
        )}
      </div>

      <YesNo
        label="첫 번째 행 헤더"
        value={value.header}
        onChange={(header) => set({ header })}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <div className={option}>
          <label className={optionLabel} htmlFor={`${id}-null`}>
            Null 값
          </label>
          <input
            id={`${id}-null`}
            className={input}
            value={value.nullValue}
            maxLength={20}
            placeholder="(빈 값)"
            onChange={(e) => set({ nullValue: e.target.value })}
          />
        </div>
        <div className={option}>
          <label className={optionLabel} htmlFor={`${id}-quote`}>
            따옴표
          </label>
          <input
            id={`${id}-quote`}
            className={input}
            value={value.quote}
            maxLength={1}
            placeholder="한 글자"
            onChange={(e) => set({ quote: e.target.value })}
          />
        </div>
      </div>

      <div className={option}>
        <Select
          label="날짜 시간 형식"
          value={format === null ? ISO : knownFormat ? format : CUSTOM}
          options={[
            { value: ISO, label: "자동 (ISO 8601)" },
            ...DATETIME_FORMATS.map((f) => ({ value: f, label: f })),
            { value: CUSTOM, label: "직접 입력" },
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
            aria-label="날짜 시간 형식 직접 입력"
            className={input}
            value={format ?? ""}
            maxLength={40}
            placeholder="yyyy-MM-dd HH:mm:ss"
            onChange={(e) => set({ datetimeFormat: e.target.value || null })}
          />
        )}
        <p className={hint}>
          yyyy·MM·dd·HH·mm·ss·SSS. 이 형식으로 읽히는 컬럼을 시계열로 봅니다.
        </p>
      </div>

      <YesNo
        label="데이터 오류 무시"
        value={value.ignoreErrors}
        onChange={(ignoreErrors) => set({ ignoreErrors })}
      />
      <p className={hint}>
        켜면 타입으로 바꿀 수 없는 값은 null로, 필드 수가 맞지 않는 행은
        건너뜁니다.
      </p>

      <div className={option}>
        <Select
          label="인코딩"
          value={value.encoding}
          options={(
            Object.entries(ENCODING_LABELS) as [CsvEncoding, string][]
          ).map(([v, label]) => ({ value: v, label }))}
          onChange={(encoding) => set({ encoding })}
        />
      </div>
    </div>
  );
}
