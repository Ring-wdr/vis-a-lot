"use client";

import { DatasetPanel } from "@/components/DatasetPanel";
import { useWorkspace } from "@/lib/workspace-store";
import { CHART_TYPES, type ChartType } from "@/server/api/types";
import { COLUMNS, type ColumnName } from "@/server/data/schema";
import { DrawButton } from "./DrawButton";
import { type Option, OrderedMultiSelect } from "./OrderedMultiSelect";
import styles from "./Workspace.module.css";

const CHART_LABELS: Record<ChartType, string> = {
  scatter: "Scatter",
  bar: "Bar",
  boxplot: "Boxplot",
};

const IMPLEMENTED = new Set<ChartType>(["scatter"]);

const GRID_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);

const AXIS_COLUMNS = COLUMNS.filter(
  (c) => c.type === "number" || c.type === "time",
);
const NUMBER_COLUMNS = COLUMNS.filter((c) => c.type === "number");
const SPLIT_OPTIONS: Option<ColumnName>[] = COLUMNS.map((c) => ({
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

export function ControlPanel() {
  const draft = useWorkspace((s) => s.draft);
  const updateDraft = useWorkspace((s) => s.updateDraft);

  return (
    <div className={styles.controls}>
      <DatasetPanel
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
              disabled={!IMPLEMENTED.has(type)}
              title={CHART_LABELS[type]}
              onClick={() => updateDraft({ chartType: type })}
            >
              <ChartIcon type={type} />
              <span>{CHART_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span>Grid</span>
        <select
          value={draft.grid.rows}
          onChange={(e) => {
            const n = Number(e.target.value);
            updateDraft({ grid: { rows: n, cols: n } });
          }}
        >
          {GRID_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} x {n}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>x</span>
        <select
          value={draft.x}
          onChange={(e) => updateDraft({ x: e.target.value as ColumnName })}
        >
          {AXIS_COLUMNS.map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>y</span>
        <select
          value={draft.y}
          onChange={(e) => updateDraft({ y: e.target.value as ColumnName })}
        >
          {NUMBER_COLUMNS.map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <OrderedMultiSelect
        label="split by"
        options={SPLIT_OPTIONS}
        value={draft.splitBy}
        onChange={(splitBy) => updateDraft({ splitBy })}
      />
      <label className={styles.inlineField}>
        구분 기호
        <input
          value={draft.splitSeparator}
          maxLength={5}
          onChange={(e) => updateDraft({ splitSeparator: e.target.value })}
        />
        <span>
          예:{" "}
          {draft.splitBy.length > 1
            ? ["A", "B", "C"]
                .slice(0, draft.splitBy.length)
                .join(draft.splitSeparator)
            : "A"}
        </span>
      </label>

      <label className={styles.field}>
        <span>tooltip</span>
        <select disabled>
          <option>x, y</option>
        </select>
      </label>

      <button type="button" className={styles.secondaryButton} disabled>
        공통 속성
      </button>

      <DrawButton />
    </div>
  );
}
