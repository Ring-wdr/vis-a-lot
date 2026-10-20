"use client";

import { ROW_LABELS } from "@/entities/dataset/lib/labels";
import { useDatasets } from "@/shared/api/queries";
import type { RowSize } from "@/shared/api/types";
import { ROW_SIZES } from "@/shared/config/dataset";
import { Select } from "@/shared/ui/Select";
import selectStyles from "@/shared/ui/Select.module.css";
import styles from "@/shared/ui/workspace.module.css";

const STATE_SUFFIX = {
  ready: "",
  generating: " · 등록 중",
  missing: " · 미등록",
} as const;

/**
 * 그릴 데이터 고르기. 등록한 규모만 고를 수 있고, 등록은 상단 data 팝업에서 한다.
 * 컬럼은 데이터의 스키마에서 정해지므로, 등록하지 않은 규모로는 그릴 수 없다.
 */
export function DatasetSelect({
  rows,
  onRowsChange,
}: {
  rows: RowSize;
  onRowsChange: (rows: RowSize) => void;
}) {
  const datasets = useDatasets();
  const status = datasets.data?.datasets.find((d) => d.rows === rows);

  return (
    <div className={styles.field}>
      <Select
        label="데이터"
        value={rows}
        options={ROW_SIZES.map((size) => {
          const state =
            datasets.data?.datasets.find((d) => d.rows === size)?.state ??
            "missing";
          return {
            value: size,
            label: `IoT 센서 · ${ROW_LABELS[size]}${STATE_SUFFIX[state]}`,
            disabled: state === "missing",
          };
        })}
        onChange={onRowsChange}
        aside={
          <span className={selectStyles.aside}>
            {status?.state === "generating"
              ? `등록 중 ${Math.floor((status.done / Math.max(1, status.total)) * 100)}%`
              : status?.state === "missing"
                ? "미등록 · data에서 등록"
                : ""}
          </span>
        }
      />
    </div>
  );
}
