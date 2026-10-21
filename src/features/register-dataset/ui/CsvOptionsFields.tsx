"use client";

import { useId } from "react";
import { DELIMITER_LABELS } from "@/entities/dataset/lib/labels";
import type { CsvOptions } from "@/shared/api/types";
import { Select } from "@/shared/ui/Select";
import styles from "./UploadDialog.module.css";

const CUSTOM = "custom";

export const DEFAULT_CSV_OPTIONS: CsvOptions = {
  delimiter: ",",
  header: true,
  nullValue: "",
};

/** CSV 전처리 옵션: 구분 기호, 첫 번째 행 헤더, Null 값. 업로드와 수정 팝업이 함께 쓴다. */
export function CsvOptionsFields({
  value,
  onChange,
}: {
  value: CsvOptions;
  onChange: (next: CsvOptions) => void;
}) {
  const id = useId();
  const known = value.delimiter in DELIMITER_LABELS;
  return (
    <div className={styles.options}>
      <div className={styles.delimiter}>
        <Select
          label="구분 기호"
          value={known ? value.delimiter : CUSTOM}
          options={[
            ...Object.entries(DELIMITER_LABELS).map(([d, label]) => ({
              value: d,
              label,
            })),
            { value: CUSTOM, label: "직접 입력" },
          ]}
          onChange={(next) =>
            onChange({ ...value, delimiter: next === CUSTOM ? "" : next })
          }
        />
        {!known && (
          <input
            aria-label="구분 기호 직접 입력"
            className={styles.input}
            value={value.delimiter}
            maxLength={1}
            placeholder="한 글자"
            onChange={(e) => onChange({ ...value, delimiter: e.target.value })}
          />
        )}
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value.header}
          onChange={(e) => onChange({ ...value, header: e.target.checked })}
        />
        첫 번째 행 헤더
      </label>
      <div className={styles.field}>
        <label htmlFor={`${id}-null`}>Null 값</label>
        <input
          id={`${id}-null`}
          className={styles.input}
          value={value.nullValue}
          maxLength={20}
          placeholder="(빈 값)"
          onChange={(e) => onChange({ ...value, nullValue: e.target.value })}
        />
      </div>
    </div>
  );
}

/** 컬럼이 달라지는 옵션(구분 기호, 헤더)이 같은지 */
export function sameShape(a: CsvOptions, b: CsvOptions) {
  return a.delimiter === b.delimiter && a.header === b.header;
}
