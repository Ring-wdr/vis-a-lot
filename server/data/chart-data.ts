// 차트 job 하나에 필요한 데이터를 한 번의 쿼리로 가져와 split 조합별로 나눈다.

import type { PGlite } from "@electric-sql/pglite";
import {
  COLUMNS,
  type ColumnName,
  type RowSize,
  readingsTable,
} from "./schema";

export type SplitGroup = {
  /** split 컬럼 순서대로의 값 (text) */
  values: string[];
  start: number;
  end: number;
};

export type ChartData = {
  groups: SplitGroup[];
  xs: Float64Array;
  ys: Float64Array;
};

export type ChartDataParams = {
  rows: RowSize;
  x: ColumnName;
  y: ColumnName;
  splitBy: ColumnName[];
};

const COLUMN_TYPE = new Map(COLUMNS.map((c) => [c.name, c.type]));

/** 숫자 축으로 쓸 값. 시계열은 epoch ms로 바꾼다. */
function numericExpr(name: ColumnName) {
  const type = COLUMN_TYPE.get(name);
  if (type === "time") return `extract(epoch from ${name}) * 1000`;
  if (type === "number") return name;
  throw new Error(`column ${name} is not numeric`);
}

export async function queryChartData(
  db: PGlite,
  { rows, x, y, splitBy }: ChartDataParams,
): Promise<ChartData> {
  for (const name of [x, y, ...splitBy]) {
    if (!COLUMN_TYPE.has(name)) throw new Error(`unknown column ${name}`);
  }
  const split = splitBy.map((c) => `${c}::text`);
  const select = [
    ...split,
    `${numericExpr(x)}::float8`,
    `${numericExpr(y)}::float8`,
  ];
  const order = splitBy.length > 0 ? `order by ${splitBy.join(", ")}` : "";
  const sql = `select ${select.join(", ")} from ${readingsTable(rows)}
    where ${x} is not null and ${y} is not null ${order}`;

  const res = await db.query<unknown[]>(sql, [], { rowMode: "array" });
  const n = res.rows.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const groups: SplitGroup[] = [];
  const k = splitBy.length;
  let current: SplitGroup | undefined;

  for (let i = 0; i < n; i++) {
    const row = res.rows[i];
    xs[i] = row[k] as number;
    ys[i] = row[k + 1] as number;
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      if (current) current.end = i;
      current = { values, start: i, end: n };
      groups.push(current);
    }
  }
  // 조건에 맞는 행이 없어도 split 없는 차트는 빈 item 하나를 그린다.
  if (groups.length === 0 && k === 0)
    groups.push({ values: [], start: 0, end: 0 });
  return { groups, xs, ys };
}
