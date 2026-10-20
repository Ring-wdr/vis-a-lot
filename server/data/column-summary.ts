// 필터 패널이 아코디언을 열 때 받는 컬럼 요약. 숫자·시계열은 범위, 범주는 값별 개수다.

import type { PGlite } from "@electric-sql/pglite";
import {
  columnOf,
  type DatasetSchema,
  ident,
  numericSql,
  textSql,
} from "./dataset-schema";

export type ColumnSummary =
  | {
      kind: "range";
      column: string;
      type: "numeric" | "datetime";
      /** 값이 하나도 없으면 null. 시계열은 epoch ms */
      min: number | null;
      max: number | null;
      nullCount: number;
      count: number;
    }
  | {
      kind: "values";
      column: string;
      /** 값 순서대로, 값마다 행 수 */
      values: { value: string; count: number }[];
      nullCount: number;
      count: number;
    };

export async function queryColumnSummary(
  db: PGlite,
  table: string,
  schema: DatasetSchema,
  name: string,
): Promise<ColumnSummary> {
  const column = columnOf(schema, name);
  const col = ident(column.name);
  if (column.type === "categorical") {
    const res = await db.query<{ value: string | null; count: number }>(
      `select ${textSql(column)} as value, count(*)::int as count
       from ${table} group by ${col} order by ${col}`,
    );
    const nullCount = res.rows.find((r) => r.value === null)?.count ?? 0;
    const values = res.rows
      .filter((r): r is { value: string; count: number } => r.value !== null)
      .map(({ value, count }) => ({ value, count }));
    return {
      kind: "values",
      column: column.name,
      values,
      nullCount,
      count: values.reduce((n, v) => n + v.count, nullCount),
    };
  }
  const v = numericSql(column);
  const res = await db.query<{
    min: number | null;
    max: number | null;
    null_count: number;
    count: number;
  }>(
    `select min(${v})::float8 as min, max(${v})::float8 as max,
       count(*) filter (where ${col} is null)::int as null_count, count(*)::int as count
     from ${table}`,
  );
  const r = res.rows[0];
  return {
    kind: "range",
    column: column.name,
    type: column.type,
    min: r.min,
    max: r.max,
    nullCount: r.null_count,
    count: r.count,
  };
}
