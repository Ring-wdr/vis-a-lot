"use client";

import { COLUMNS, type ColumnName } from "@server/data/schema";
import { useState } from "react";
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

function Instance<T extends string>({
  label,
  options,
}: {
  label: string;
  options: readonly Option<T>[];
}) {
  const [value, setValue] = useState<T[]>([]);
  return (
    <section className={styles.instance}>
      <OrderedSelect
        label={label}
        options={options}
        value={value}
        onChange={setValue}
      />
      <output data-testid={`value-${label}`} className={styles.output}>
        {JSON.stringify(value)}
      </output>
    </section>
  );
}

/** 대량(10,000개)과 실제 컬럼 옵션, 그리고 fieldset disabled 안의 인스턴스 */
export function DevSelectPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>OrderedSelect</h1>
      <Instance label="대량" options={MANY_OPTIONS} />
      <Instance label="컬럼" options={COLUMN_OPTIONS} />
      <fieldset disabled className={styles.disabled}>
        <legend>fieldset disabled</legend>
        <OrderedSelect
          label="잠김"
          options={COLUMN_OPTIONS}
          value={["factory", "line"]}
          onChange={() => {
            throw new Error("disabled인데 값이 바뀌었다");
          }}
        />
      </fieldset>
    </main>
  );
}
