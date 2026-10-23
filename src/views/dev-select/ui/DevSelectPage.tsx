"use client";

import { useState } from "react";
import type { ColumnName } from "@/shared/api/types";
import { type Option, OrderedSelect } from "@/shared/ui/OrderedSelect";

const MANY_OPTIONS: Option<string>[] = Array.from(
  { length: 10_000 },
  (_, i) => ({
    value: `o${i + 1}`,
    label: `옵션 ${String(i + 1).padStart(5, "0")}`,
  }),
);

/** mock 서버 없이 쓰는 컬럼 예시 (실제 화면은 데이터셋 스키마에서 받는다) */
const COLUMN_OPTIONS: Option<ColumnName>[] = [
  ["ts", "측정 시각"],
  ["factory", "공장"],
  ["line", "라인"],
  ["machine", "설비"],
  ["sensor_type", "센서 종류"],
  ["shift", "근무조"],
  ["lot_id", "LOT"],
  ["status", "상태"],
  ["value", "측정값"],
  ["temperature_env", "주변 온도"],
  ["load_pct", "부하율(%)"],
].map(([value, label]) => ({ value, label }));

/** mock 서버 없이 OrderedSelect만 띄워 드래그/키보드 동작을 확인하는 페이지 */
const output = "mt-1.5 block break-all font-mono text-11 text-fg-secondary";

export function DevSelectPage() {
  const [many, setMany] = useState<string[]>([]);
  const [columns, setColumns] = useState<ColumnName[]>([]);
  const [fieldsetDisabled, setFieldsetDisabled] = useState(false);

  return (
    <main className="flex max-w-90 flex-col gap-4 p-6">
      <h1 className="font-bold text-16">OrderedSelect</h1>
      <label className="flex gap-1.5 text-13">
        <input
          type="checkbox"
          checked={fieldsetDisabled}
          onChange={(e) => setFieldsetDisabled(e.target.checked)}
        />
        fieldset disabled
      </label>
      <fieldset
        className="flex min-w-0 flex-col gap-6"
        disabled={fieldsetDisabled}
      >
        <section>
          <OrderedSelect
            label="대량"
            options={MANY_OPTIONS}
            value={many}
            onChange={setMany}
          />
          <output className={output} data-testid="value-대량">
            {JSON.stringify(many)}
          </output>
        </section>
        <section>
          <OrderedSelect
            label="컬럼"
            options={COLUMN_OPTIONS}
            value={columns}
            onChange={setColumns}
          />
          <output className={output} data-testid="value-컬럼">
            {JSON.stringify(columns)}
          </output>
        </section>
      </fieldset>
    </main>
  );
}
