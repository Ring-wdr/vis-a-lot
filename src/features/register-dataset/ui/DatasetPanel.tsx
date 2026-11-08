"use client";

import { useEffect } from "react";
import { useDatasetLabels } from "@/entities/dataset/lib/labels";
import {
  useDatasetSchema,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId } from "@/shared/api/types";
import { defineMessages, intlLocale, useT } from "@/shared/lib/i18n";
import { Select } from "@/shared/ui/Select";

const messages = defineMessages({
  ko: {
    scale: "데이터 규모",
    ready: " · 준비됨",
    analyzing: "컬럼 통계 계산 중…",
    generating: (done: string, total: string) =>
      `데이터 생성 중 ${done} / ${total}`,
    generated: (rows: string, seconds: string) =>
      `${rows}행 · 생성 ${seconds}초`,
    column: "컬럼",
    type: "타입",
    distinct: "고유값",
  },
  en: {
    scale: "Data size",
    ready: " · ready",
    analyzing: "Computing column stats…",
    generating: (done: string, total: string) =>
      `Generating data ${done} / ${total}`,
    generated: (rows: string, seconds: string) =>
      `${rows} rows · generated in ${seconds}s`,
    column: "Column",
    type: "Type",
    distinct: "Distinct",
  },
});

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
  const text = useT(messages);
  const labels = useDatasetLabels();
  const locale = intlLocale();
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
        label={text.scale}
        value={dataset}
        options={(samples ?? []).map((s) => ({
          value: s.id,
          label: `${s.name}${s.state === "ready" ? text.ready : ""}`,
        }))}
        onChange={onChange}
      />

      {status?.state === "generating" && (
        <div className="flex flex-col gap-1 text-xs text-fg-muted">
          <progress className="w-full" value={status.done} max={status.total} />
          <span>
            {status.phase === "analyze"
              ? text.analyzing
              : text.generating(
                  status.done.toLocaleString(locale),
                  status.total.toLocaleString(locale),
                )}
          </span>
        </div>
      )}

      {status?.state === "ready" && status.generateMs !== undefined && (
        <p className="text-xs text-fg-muted">
          {text.generated(
            status.total.toLocaleString(locale),
            (status.generateMs / 1000).toFixed(1),
          )}
        </p>
      )}

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {showColumns && columns.data && (
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className={cell}>{text.column}</th>
              <th className={cell}>{text.type}</th>
              <th className={cell}>{text.distinct}</th>
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
