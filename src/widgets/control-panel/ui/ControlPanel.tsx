"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { GridPicker } from "@/features/change-grid/ui/GridPicker";
import { DatasetSelect } from "@/features/register-dataset/ui/DatasetSelect";
import {
  type AggFn,
  CHART_TYPES,
  type ChartSpec,
  type ChartType,
  type ColumnName,
  type LegendColumn,
} from "@/shared/api/types";
import {
  AGG_FNS,
  AGG_LABELS,
  COLUMNS,
  LEGEND_COLUMNS,
} from "@/shared/config/dataset";
import { type Option, OrderedSelect } from "@/shared/ui/OrderedSelect";
import { Select, type SelectOption } from "@/shared/ui/Select";
import styles from "@/shared/ui/workspace.module.css";

const CHART_LABELS: Record<ChartType, string> = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
};

/** 차트 종류를 바꿀 때 그 종류에 맞지 않는 x 축 컬럼은 기본값으로 바꾼다. */
function switchChartType(
  draft: ChartSpec,
  chartType: ChartType,
): Partial<ChartSpec> {
  const allowed = chartType === "scatter" ? AXIS_COLUMNS : CATEGORY_COLUMNS;
  if (allowed.some((c) => c.name === draft.x)) return { chartType };
  return { chartType, x: chartType === "scatter" ? "ts" : "sensor_type" };
}

const CATEGORY_COLUMNS = COLUMNS.filter((c) => c.type === "string");
const AXIS_COLUMNS = COLUMNS.filter(
  (c) => c.type === "number" || c.type === "time",
);
const NUMBER_COLUMNS = COLUMNS.filter((c) => c.type === "number");
const LEGEND_OPTIONS = COLUMNS.filter((c) =>
  (LEGEND_COLUMNS as readonly string[]).includes(c.name),
);
/** legend 없음. select 값은 null을 담지 못해 빈 문자열로 대신한다. */
const NO_LEGEND = "";
const LEGEND_SELECT_OPTIONS: SelectOption<LegendColumn | typeof NO_LEGEND>[] = [
  { value: NO_LEGEND, label: "없음" },
  ...LEGEND_OPTIONS.map((c) => ({
    value: c.name as LegendColumn,
    label: c.label,
  })),
];
const AGG_OPTIONS: SelectOption<AggFn>[] = AGG_FNS.map((fn) => ({
  value: fn,
  label: AGG_LABELS[fn],
}));

function toOptions(columns: readonly { name: ColumnName; label: string }[]) {
  return columns.map((c) => ({ value: c.name, label: c.label }));
}

const COLUMN_OPTIONS: Option<ColumnName>[] = COLUMNS.map((c) => ({
  value: c.name,
  label: c.label,
}));

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

  return (
    <fieldset className={styles.controls} disabled={readOnly}>
      <DatasetSelect
        rows={draft.rows}
        onRowsChange={(rows) => updateDraft({ rows })}
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
              onClick={() => updateDraft(switchChartType(draft, type))}
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
        value={draft.x}
        options={toOptions(
          draft.chartType === "scatter" ? AXIS_COLUMNS : CATEGORY_COLUMNS,
        )}
        onChange={(x) => updateDraft({ x })}
      />

      <Select
        label="y"
        value={draft.y}
        options={toOptions(NUMBER_COLUMNS)}
        onChange={(y) => updateDraft({ y })}
      />

      <Select
        label="legend"
        value={draft.legend ?? NO_LEGEND}
        options={LEGEND_SELECT_OPTIONS}
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
        options={COLUMN_OPTIONS}
        value={draft.splitBy}
        onChange={(splitBy) => updateDraft({ splitBy })}
      />

      <OrderedSelect
        label="tooltip"
        options={COLUMN_OPTIONS.filter(
          (o) => o.value !== draft.x && o.value !== draft.y,
        )}
        value={draft.tooltip}
        placeholder="x, y 외 컬럼 추가…"
        onChange={(tooltip) => updateDraft({ tooltip })}
      />
    </fieldset>
  );
}
