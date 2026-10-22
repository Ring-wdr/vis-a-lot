"use client";

import { useMemo } from "react";
import { COLUMN_TYPE_LABELS } from "@/entities/dataset/lib/labels";
import type { ColumnType, CsvPreview } from "@/shared/api/types";
import styles from "./UploadDialog.module.css";

const AUTO = "auto";

export type GridColumn = {
  name: string;
  /** 자동일 때 쓰는 타입 (검사했으면 전체 기준, 아니면 미리보기 기준) */
  inferred: ColumnType;
  /** 직접 정한 타입. 없으면 자동 */
  chosen?: ColumnType;
  included: boolean;
  /** 검사에서 타입으로 바꿀 수 없던 값 수 */
  invalid?: number;
};

/**
 * 미리보기 표. 머리 첫 줄은 적재할지(체크), 둘째 줄은 타입이다. 아래는 정한 타입으로 바꾼 앞쪽 행이고,
 * 바꿀 수 없는 칸은 원래 값을 표시해 둔다.
 */
export function PreviewGrid({
  columns,
  preview,
  onInclude,
  onIncludeAll,
  onType,
}: {
  columns: GridColumn[];
  preview: CsvPreview;
  onInclude: (name: string, included: boolean) => void;
  onIncludeAll: (included: boolean) => void;
  onType: (name: string, type: ColumnType | undefined) => void;
}) {
  const invalid = useMemo(
    () => new Set(preview.invalid.map(([r, c]) => `${r}:${c}`)),
    [preview.invalid],
  );
  const allIncluded = columns.every((c) => c.included);
  const noneIncluded = columns.every((c) => !c.included);

  return (
    <div className={styles.gridScroll}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.rowHead}>
              <input
                type="checkbox"
                aria-label="모든 컬럼 적재"
                checked={allIncluded}
                ref={(el) => {
                  if (el) el.indeterminate = !allIncluded && !noneIncluded;
                }}
                onChange={(e) => onIncludeAll(e.target.checked)}
              />
            </th>
            {columns.map((c) => (
              <th key={c.name} data-excluded={!c.included || undefined}>
                <label className={styles.columnName} title={c.name}>
                  <input
                    type="checkbox"
                    checked={c.included}
                    onChange={(e) => onInclude(c.name, e.target.checked)}
                  />
                  <span>{c.name}</span>
                </label>
              </th>
            ))}
          </tr>
          <tr>
            <th className={styles.rowHead} aria-label="행 번호" />
            {columns.map((c) => (
              <th key={c.name} data-excluded={!c.included || undefined}>
                <select
                  aria-label={`${c.name} 타입`}
                  className={styles.typeSelect}
                  value={c.chosen ?? AUTO}
                  disabled={!c.included}
                  onChange={(e) =>
                    onType(
                      c.name,
                      e.target.value === AUTO
                        ? undefined
                        : (e.target.value as ColumnType),
                    )
                  }
                >
                  <option value={AUTO}>
                    자동 ({COLUMN_TYPE_LABELS[c.inferred]})
                  </option>
                  {(
                    Object.entries(COLUMN_TYPE_LABELS) as [ColumnType, string][]
                  ).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                {c.included && c.invalid ? (
                  <span className={styles.invalidCount}>
                    변환 불가 {c.invalid.toLocaleString()}개
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, r) => (
            // 미리보기 행은 순서만 있고 바뀌지 않는다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 행 번호가 곧 식별자다.
            <tr key={r}>
              <th className={styles.rowHead}>{r}</th>
              {row.map((value, c) => {
                const column = columns[c];
                const bad = invalid.has(`${r}:${c}`);
                return (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: 열 순서가 곧 식별자다.
                    key={c}
                    data-excluded={!column?.included || undefined}
                    data-invalid={bad || undefined}
                    data-null={value === null || undefined}
                    title={bad ? "이 타입으로 바꿀 수 없는 값" : undefined}
                  >
                    {value ?? "null"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
