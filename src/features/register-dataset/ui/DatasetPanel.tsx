"use client";

import { useEffect } from "react";
import { COLUMN_TYPE_LABELS } from "@/entities/dataset/lib/labels";
import {
  useDatasetSchema,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId } from "@/shared/api/types";
import { Select } from "@/shared/ui/Select";

const cell = "border-line border-b px-2 py-1 text-left last:text-right";

/** 샘플 데이터 규모 고르기 (구조 검증 페이지). 고르면 없을 때 바로 생성을 시작한다. */
export function DatasetPanel({
  dataset,
  onChange,
  showColumns = false,
}: {
  dataset: DatasetId;
  onChange: (dataset: DatasetId) => void;
  /** 컬럼 타입과 고유값 표를 함께 보여준다. */
  showColumns?: boolean;
}) {
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const samples = datasets.data?.datasets.filter((d) => d.kind === "sample");
  const status = samples?.find((d) => d.id === dataset);
  const columns = useDatasetSchema(dataset);
  const { mutate } = generate;

  // 규모를 고르면 그 데이터가 없을 때 바로 생성을 시작한다.
  useEffect(() => {
    if (status?.state === "missing") mutate(dataset);
  }, [status?.state, dataset, mutate]);

  return (
    <section className="flex max-w-90 flex-col gap-2">
      <Select
        label="데이터 규모"
        value={dataset}
        options={(samples ?? []).map((s) => ({
          value: s.id,
          label: `${s.name}${s.state === "ready" ? " · 준비됨" : ""}`,
        }))}
        onChange={onChange}
      />

      {status?.state === "generating" && (
        <div className="flex flex-col gap-1 text-fg-muted text-xs">
          <progress className="w-full" value={status.done} max={status.total} />
          <span>
            {status.phase === "analyze"
              ? "컬럼 통계 계산 중…"
              : `데이터 생성 중 ${status.done.toLocaleString()} / ${status.total.toLocaleString()}`}
          </span>
        </div>
      )}

      {status?.state === "ready" && status.generateMs !== undefined && (
        <p className="text-fg-muted text-xs">
          {status.total.toLocaleString()}행 · 생성{" "}
          {(status.generateMs / 1000).toFixed(1)}초
        </p>
      )}

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {showColumns && columns.data && (
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className={cell}>컬럼</th>
              <th className={cell}>타입</th>
              <th className={cell}>고유값</th>
            </tr>
          </thead>
          <tbody>
            {columns.data.columns.map((c) => (
              <tr key={c.name}>
                <td className={cell} title={c.name}>
                  {c.label}
                </td>
                <td className={cell}>{COLUMN_TYPE_LABELS[c.type]}</td>
                <td className={cell}>{c.distinct?.toLocaleString() ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
