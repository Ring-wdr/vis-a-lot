"use client";

import { useEffect } from "react";
import { COLUMN_TYPE_LABELS, ROW_LABELS } from "@/entities/dataset/lib/labels";
import {
  useColumns,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { RowSize } from "@/shared/api/types";
import { ROW_SIZES } from "@/shared/config/dataset";
import { Select } from "@/shared/ui/Select";
import styles from "./DatasetPanel.module.css";

export function DatasetPanel({
  rows,
  onRowsChange,
  showColumns = false,
}: {
  rows: RowSize;
  onRowsChange: (rows: RowSize) => void;
  /** 컬럼 타입과 고유값 표를 함께 보여준다. */
  showColumns?: boolean;
}) {
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const status = datasets.data?.datasets.find((d) => d.rows === rows);
  const columns = useColumns(rows, showColumns && status?.state === "ready");
  const { mutate } = generate;

  // 행 수를 고르면 그 규모의 데이터가 없을 때 바로 생성을 시작한다.
  useEffect(() => {
    if (status?.state === "missing") mutate(rows);
  }, [status?.state, rows, mutate]);

  return (
    <section className={styles.panel}>
      <Select
        label="데이터 규모"
        value={rows}
        options={ROW_SIZES.map((size) => {
          const s = datasets.data?.datasets.find((d) => d.rows === size);
          return {
            value: size,
            label: `${ROW_LABELS[size]}${s?.state === "ready" ? " · 준비됨" : ""}`,
          };
        })}
        onChange={onRowsChange}
      />

      {status?.state === "generating" && (
        <div className={styles.progress}>
          <progress value={status.done} max={status.total} />
          <span>
            {status.phase === "analyze"
              ? "컬럼 통계 계산 중…"
              : `데이터 생성 중 ${status.done.toLocaleString()} / ${status.total.toLocaleString()}`}
          </span>
        </div>
      )}

      {status?.state === "ready" && status.generateMs !== undefined && (
        <p className={styles.meta}>
          {status.total.toLocaleString()}행 · 생성{" "}
          {(status.generateMs / 1000).toFixed(1)}초
        </p>
      )}

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {showColumns && columns.data && (
        <table className={styles.columns}>
          <thead>
            <tr>
              <th>컬럼</th>
              <th>타입</th>
              <th>고유값</th>
            </tr>
          </thead>
          <tbody>
            {columns.data.columns.map((c) => (
              <tr key={c.name}>
                <td title={c.name}>{c.label}</td>
                <td>{COLUMN_TYPE_LABELS[c.type]}</td>
                <td>{c.distinct.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
