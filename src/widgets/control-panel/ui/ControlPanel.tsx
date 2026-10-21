"use client";

import { useEffect } from "react";
import { CHART_LABELS } from "@/entities/chart/lib/title";
import {
  axisColumns,
  fitSpecToSchema,
  legendColumns,
  numericColumns,
} from "@/entities/dataset/model/column-roles";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { GridPicker } from "@/features/change-grid/ui/GridPicker";
import { DatasetSelect } from "@/features/register-dataset/ui/DatasetSelect";
import { useDatasetSchema, useSchemaState } from "@/shared/api/queries";
import {
  type AggFn,
  CHART_TYPES,
  type ChartType,
  type ColumnInfo,
  type ColumnName,
} from "@/shared/api/types";
import { AGG_FNS, AGG_LABELS } from "@/shared/config/dataset";
import { LoadingText } from "@/shared/ui/Loading";
import { type Option, OrderedSelect } from "@/shared/ui/OrderedSelect";
import { Select, type SelectOption } from "@/shared/ui/Select";
import styles from "@/shared/ui/workspace.module.css";

/** legend 없음. select는 빈 값을 '고르지 않음'으로 보므로 컬럼 이름이 될 수 없는 값을 쓴다. */
const NO_LEGEND = "\u0000none";
const AGG_OPTIONS: SelectOption<AggFn>[] = AGG_FNS.map((fn) => ({
  value: fn,
  label: AGG_LABELS[fn],
}));

function toOptions(columns: readonly ColumnInfo[]): Option<ColumnName>[] {
  return columns.map((c) => ({ value: c.name, label: c.label }));
}

function ChartIcon({ type }: { type: ChartType }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {type === "scatter" && (
        <g fill="currentColor">
          <circle cx="6" cy="16" r="2" />
          <circle cx="10" cy="10" r="2" />
          <circle cx="15" cy="13" r="2" />
          <circle cx="18" cy="6" r="2" />
        </g>
      )}
      {type === "bar" && (
        <g fill="currentColor">
          <rect x="4" y="12" width="4" height="8" rx="1" />
          <rect x="10" y="6" width="4" height="14" rx="1" />
          <rect x="16" y="9" width="4" height="11" rx="1" />
        </g>
      )}
      {type === "boxplot" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 3v4M8 17v4M16 5v4M16 15v4" />
          <rect x="5" y="7" width="6" height="10" rx="1" />
          <rect x="13" y="9" width="6" height="6" rx="1" />
        </g>
      )}
    </svg>
  );
}

/**
 * 차트 설정. draw를 눌러야 반영된다. 다시 보기 전용 화면(history)에서는 그 차트의 설정을 보여주기만 하고
 * fieldset disabled로 안의 입력을 모두 막는다.
 */
export function ControlPanel() {
  const draft = useWorkspace((s) => s.draft);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const readOnly = useWorkspace((s) => s.readOnly);
  // 컬럼은 데이터마다 달라 고른 데이터셋의 스키마에서 후보를 고른다.
  const schema = useDatasetSchema(draft.dataset);
  const columns = schema.data?.columns;
  const schemaState = useSchemaState(draft.dataset);
  const noColumns =
    schemaState === "loading" ? (
      <LoadingText announce={false}>컬럼 불러오는 중</LoadingText>
    ) : schemaState === "generating" ? (
      "데이터 등록이 끝나면 고를 수 있습니다"
    ) : schemaState === "missing" ? (
      "데이터를 등록하면 고를 수 있습니다"
    ) : undefined;

  // 스키마를 처음 받았거나 데이터셋을 바꿨으면, 맞지 않는 설정을 기본값으로 바로잡는다.
  useEffect(() => {
    if (readOnly || !columns) return;
    const patch = fitSpecToSchema(draft, columns);
    if (patch) updateDraft(patch);
  }, [readOnly, columns, draft, updateDraft]);

  const allOptions = toOptions(columns ?? []);

  return (
    <fieldset className={styles.controls} disabled={readOnly}>
      <DatasetSelect
        dataset={draft.dataset}
        onChange={(dataset) => updateDraft({ dataset })}
      />

      <fieldset className={styles.field}>
        <legend>차트 종류</legend>
        <div className={styles.chartTypes}>
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={draft.chartType === type}
              title={CHART_LABELS[type]}
              onClick={() => {
                // 차트 종류마다 x축에 쓸 수 있는 타입이 달라 그에 맞게 바로잡는다.
                const next = { ...draft, chartType: type };
                updateDraft({
                  chartType: type,
                  ...(columns && fitSpecToSchema(next, columns)),
                });
              }}
            >
              <ChartIcon type={type} />
              <span>{CHART_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <GridPicker />

      <Select
        label="x"
        value={draft.x || null}
        placeholder={noColumns}
        options={toOptions(axisColumns(columns ?? [], draft.chartType))}
        onChange={(x) => updateDraft({ x })}
      />

      <Select
        label="y"
        value={draft.y || null}
        placeholder={noColumns}
        options={toOptions(numericColumns(columns ?? []))}
        onChange={(y) => updateDraft({ y })}
      />

      <Select
        label="legend"
        value={draft.legend ?? NO_LEGEND}
        options={[
          { value: NO_LEGEND, label: "없음" },
          ...toOptions(legendColumns(columns ?? [])),
        ]}
        onChange={(legend) =>
          updateDraft({ legend: legend === NO_LEGEND ? null : legend })
        }
      />

      {draft.chartType === "bar" && (
        <Select
          label="통계 함수"
          value={draft.agg}
          options={AGG_OPTIONS}
          onChange={(agg) => updateDraft({ agg })}
        />
      )}

      <OrderedSelect
        label="split by"
        options={allOptions}
        value={draft.splitBy}
        onChange={(splitBy) => updateDraft({ splitBy })}
      />

      <OrderedSelect
        label="tooltip"
        options={allOptions.filter(
          (o) => o.value !== draft.x && o.value !== draft.y,
        )}
        value={draft.tooltip}
        placeholder="x, y 외 컬럼 추가…"
        onChange={(tooltip) => updateDraft({ tooltip })}
      />
    </fieldset>
  );
}
