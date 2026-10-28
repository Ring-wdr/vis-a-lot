"use client";

import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";
import { useDatasetLabels } from "@/entities/dataset/lib/labels";
import type { ColumnType, CsvPreview } from "@/shared/api/types";
import { intlLocale } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import "../config/messages";

const AUTO = "auto";

const cell =
  "min-w-30 max-w-55 truncate border-line border-r border-b px-2 py-1 data-excluded:opacity-40";
const headCell = cn(cell, "z-sticky sticky bg-panel text-left");
const rowHead = cn(
  cell,
  "z-sticky-col sticky left-0 w-11 min-w-11 bg-panel text-center font-normal text-fg-muted",
);
// 머리의 행 번호 칸은 가로·세로 sticky 칸 위에 온다.
const headRowHead = cn(rowHead, "z-sticky-corner");
// 첫 줄(이름)은 높이를 정해 두고, 둘째 줄(타입)을 그만큼 내려 붙인다.
const firstRow = "top-0 h-7.5";
const secondRow = "top-7.5";

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
  const { t } = useLingui();
  const labels = useDatasetLabels();
  const columnTypeLabel = (name: string) =>
    t({ message: `${name} 타입`, comment: "name: 컬럼 이름" });
  const autoLabel = (inferred: ColumnType) => {
    const type = labels.columnTypes[inferred];
    return t({
      message: `자동 (${type})`,
      comment: "type: 자동으로 고른 컬럼 타입 이름",
    });
  };
  const invalidLabel = (n: number) => {
    const count = n.toLocaleString(intlLocale());
    return t`변환 불가 ${count}개`;
  };
  const invalid = useMemo(
    () => new Set(preview.invalid.map(([r, c]) => `${r}:${c}`)),
    [preview.invalid],
  );
  const allIncluded = columns.every((c) => c.included);
  const noneIncluded = columns.every((c) => !c.included);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="border-separate border-spacing-0 text-xs tabular-nums">
        <thead>
          <tr>
            <th className={cn(headRowHead, firstRow)}>
              <input
                type="checkbox"
                aria-label={t`모든 컬럼 적재`}
                checked={allIncluded}
                ref={(el) => {
                  if (el) el.indeterminate = !allIncluded && !noneIncluded;
                }}
                onChange={(e) => onIncludeAll(e.target.checked)}
              />
            </th>
            {columns.map((c) => (
              <th
                key={c.name}
                className={cn(headCell, firstRow)}
                data-excluded={!c.included || undefined}
              >
                <label
                  className="flex min-w-0 cursor-pointer items-center gap-1.5 font-semibold"
                  title={c.name}
                >
                  <input
                    type="checkbox"
                    checked={c.included}
                    onChange={(e) => onInclude(c.name, e.target.checked)}
                  />
                  <span className="overflow-hidden text-ellipsis">
                    {c.name}
                  </span>
                </label>
              </th>
            ))}
          </tr>
          <tr>
            <th
              className={cn(headRowHead, secondRow)}
              aria-label={t`행 번호`}
            />
            {columns.map((c) => (
              <th
                key={c.name}
                className={cn(headCell, secondRow)}
                data-excluded={!c.included || undefined}
              >
                <select
                  aria-label={columnTypeLabel(c.name)}
                  className="w-full rounded-sm border border-line bg-elevated px-1 py-0.5 text-xs"
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
                  <option value={AUTO}>{autoLabel(c.inferred)}</option>
                  {(
                    Object.entries(labels.columnTypes) as [ColumnType, string][]
                  ).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                {c.included && c.invalid ? (
                  <span className="mt-0.5 block text-2xs font-normal text-danger">
                    {invalidLabel(c.invalid)}
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
              <th className={rowHead}>{r}</th>
              {row.map((value, c) => {
                const column = columns[c];
                const bad = invalid.has(`${r}:${c}`);
                return (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: 열 순서가 곧 식별자다.
                    key={c}
                    className={cn(
                      cell,
                      "text-right data-invalid:bg-danger/10 data-invalid:text-danger data-null:italic data-null:not-data-invalid:text-fg-muted",
                    )}
                    data-excluded={!column?.included || undefined}
                    data-invalid={bad || undefined}
                    data-null={value === null || undefined}
                    title={bad ? t`이 타입으로 바꿀 수 없는 값` : undefined}
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
