"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect } from "react";
import { useDatasetLabels } from "@/entities/dataset/lib/labels";
import {
  useDatasetSchema,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId } from "@/shared/api/types";
import { intlLocale } from "@/shared/lib/i18n";
import { Select } from "@/shared/ui/Select";
import "../config/messages";

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
  const { t } = useLingui();
  const labels = useDatasetLabels();
  const locale = intlLocale();
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const samples = datasets.data?.datasets.filter((d) => d.kind === "sample");
  const status = samples?.find((d) => d.id === dataset);
  const columns = useDatasetSchema(dataset);
  const { mutate } = generate;
  const readyLabel = (name: string) =>
    t({ message: `${name} · 준비됨`, comment: "name: 데이터 이름" });
  const generating = (s: { done: number; total: number }) => {
    const done = s.done.toLocaleString(locale);
    const total = s.total.toLocaleString(locale);
    return t`데이터 생성 중 ${done} / ${total}`;
  };
  const generated = (count: number, ms: number) => {
    const rows = count.toLocaleString(locale);
    const seconds = (ms / 1000).toFixed(1);
    return t`${rows}행 · 생성 ${seconds}초`;
  };

  // 규모를 고르면 그 데이터가 없을 때 바로 생성을 시작한다.
  useEffect(() => {
    if (status?.state === "missing") mutate(dataset);
  }, [status?.state, dataset, mutate]);

  return (
    <section className="flex max-w-90 flex-col gap-2">
      <Select
        label={t`데이터 규모`}
        value={dataset}
        options={(samples ?? []).map((s) => ({
          value: s.id,
          label: s.state === "ready" ? readyLabel(s.name) : s.name,
        }))}
        onChange={onChange}
      />

      {status?.state === "generating" && (
        <div className="flex flex-col gap-1 text-xs text-fg-muted">
          <progress className="w-full" value={status.done} max={status.total} />
          <span>
            {status.phase === "analyze"
              ? t`컬럼 통계 계산 중…`
              : generating(status)}
          </span>
        </div>
      )}

      {status?.state === "ready" && status.generateMs !== undefined && (
        <p className="text-xs text-fg-muted">
          {generated(status.total, status.generateMs)}
        </p>
      )}

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {showColumns && columns.data && (
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className={cell}>
                <Trans context="column table header">컬럼</Trans>
              </th>
              <th className={cell}>
                <Trans context="column table header">타입</Trans>
              </th>
              <th className={cell}>
                <Trans context="column table header">고유값</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.data.columns.map((c) => (
              <tr key={c.name}>
                <td className={cell} title={c.name}>
                  {c.label}
                </td>
                <td className={cell}>{labels.columnTypes[c.type]}</td>
                <td className={cell}>
                  {c.distinct?.toLocaleString(locale) ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
