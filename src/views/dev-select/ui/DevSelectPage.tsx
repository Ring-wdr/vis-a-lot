"use client";

import { useState } from "react";
import type { ColumnName } from "@/shared/api/types";
import { COLUMNS } from "@/shared/config/dataset";
import { type Option, OrderedSelect } from "@/shared/ui/OrderedSelect";
import styles from "./DevSelectPage.module.css";

const MANY_OPTIONS: Option<string>[] = Array.from(
  { length: 10_000 },
  (_, i) => ({
    value: `o${i + 1}`,
    label: `옵션 ${String(i + 1).padStart(5, "0")}`,
  }),
);

const COLUMN_OPTIONS: Option<ColumnName>[] = COLUMNS.map((c) => ({
  value: c.name,
  label: c.label,
}));

/** mock 서버 없이 OrderedSelect만 띄워 드래그/키보드 동작을 확인하는 페이지 */
export function DevSelectPage() {
  const [many, setMany] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnName[]>([]);
  const [fieldsetDisabled, setFieldsetDisabled] = useState(false);

  return (
    <main className={styles.main}>
      <h1>OrderedSelect</h1>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={fieldsetDisabled}
          onChange={(e) => setFieldsetDisabled(e.target.checked)}
        />
        fieldset disabled
      </label>
      <fieldset className={styles.fieldset} disabled={fieldsetDisabled}>
        <section>
          <OrderedSelect
            label="대량"
            options={MANY_OPTIONS}
            value={many}
            onChange={setMany}
          />
          <output data-testid="value-대량">{JSON.stringify(many)}</output>
        </section>
        <section>
          <OrderedSelect
            label="컬럼"
            options={COLUMN_OPTIONS}
            value={columns}
            onChange={setColumns}
          />
          <output data-testid="value-컬럼">{JSON.stringify(columns)}</output>
        </section>
      </fieldset>
    </main>
  );
}
