// bar / boxplot 데이터. 집계는 DB(PGlite)가 SQL로 하고, split 조합 × x 범주 단위로 돌려준다.

import type { PGlite } from "@electric-sql/pglite";
import {
  type AggFn,
  COLUMNS,
  type ColumnName,
  type RowSize,
  readingsTable,
} from "./schema";

export type BoxStats = {
  n: number;
  mean: number;
  q1: number;
  median: number;
  q3: number;
  /** 1.5 IQR 안쪽의 최솟값/최댓값 (수염 끝) */
  lo: number;
  hi: number;
  outlierCount: number;
  /** 그릴 이상치 (최대 OUTLIER_SAMPLE개) */
  outliers: number[];
};

export type CategoryGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** x 범주. 순서가 곧 x축 인덱스다. */
  categories: string[];
  bars?: number[];
  boxes?: BoxStats[];
};

export type CategoryData = { groups: CategoryGroup[] };

export type CategoryDataParams = {
  rows: RowSize;
  chartType: "bar" | "boxplot";
  x: ColumnName;
  y: ColumnName;
  agg: AggFn;
  splitBy: ColumnName[];
};

const COLUMN_TYPE = new Map(COLUMNS.map((c) => [c.name, c.type]));
const OUTLIER_SAMPLE = 200;

const AGG_SQL: Record<AggFn, (y: string) => string> = {
  avg: (y) => `avg(${y})`,
  sum: (y) => `sum(${y})`,
  count: () => "count(*)",
  min: (y) => `min(${y})`,
  max: (y) => `max(${y})`,
  median: (y) => `percentile_cont(0.5) within group (order by ${y})`,
};

function check(params: CategoryDataParams) {
  const { x, y, splitBy } = params;
  for (const name of [x, y, ...splitBy]) {
    if (!COLUMN_TYPE.has(name)) throw new Error(`unknown column ${name}`);
  }
  if (COLUMN_TYPE.get(y) !== "number") throw new Error(`${y} is not numeric`);
}

/** 정렬된 행(split…, 범주, 값…)을 split 조합 단위로 묶는다. */
function groupRows<T>(
  rows: unknown[][],
  k: number,
  read: (row: unknown[]) => T,
): { values: string[]; categories: string[]; items: T[] }[] {
  const groups: { values: string[]; categories: string[]; items: T[] }[] = [];
  let current: (typeof groups)[number] | undefined;
  for (const row of rows) {
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = { values, categories: [], items: [] };
      groups.push(current);
    }
    current.categories.push(String(row[k]));
    current.items.push(read(row));
  }
  return groups;
}

export async function queryBarData(
  db: PGlite,
  params: CategoryDataParams,
): Promise<CategoryData> {
  check(params);
  const { rows, x, y, agg, splitBy } = params;
  const split = splitBy.map((c) => `${c}::text`);
  const keys = [...splitBy, x];
  const sql = `select ${[...split, `${x}::text`].join(", ")}, ${AGG_SQL[agg](y)}::float8
    from ${readingsTable(rows)} where ${y} is not null
    group by ${keys.join(", ")} order by ${keys.join(", ")}`;
  const res = await db.query<unknown[]>(sql, [], { rowMode: "array" });
  const k = splitBy.length;
  return {
    groups: groupRows(res.rows, k, (row) => row[k + 1] as number).map((g) => ({
      values: g.values,
      categories: g.categories,
      bars: g.items,
    })),
  };
}

/** 사분위수는 percentile_cont, 수염은 1.5 IQR 안쪽의 최솟값/최댓값, 바깥은 이상치 */
export async function queryBoxData(
  db: PGlite,
  params: CategoryDataParams,
): Promise<CategoryData> {
  check(params);
  const { rows, x, y, splitBy } = params;
  const keys = [
    ...splitBy.map((c) => `${c}::text as ${c}`),
    `${x}::text as _cat`,
  ];
  const keyNames = [...splitBy, "_cat"];
  const join = keyNames.map((c) => `s.${c} = q.${c}`).join(" and ");
  const lowFence = "q.q1 - 1.5 * (q.q3 - q.q1)";
  const highFence = "q.q3 + 1.5 * (q.q3 - q.q1)";
  const sql = `
    with s as (
      select ${keys.join(", ")}, ${y}::float8 as v
      from ${readingsTable(rows)} where ${y} is not null
    ),
    q as (
      select ${keyNames.join(", ")},
        count(*)::int as n, avg(v) as mean,
        percentile_cont(0.25) within group (order by v) as q1,
        percentile_cont(0.5) within group (order by v) as median,
        percentile_cont(0.75) within group (order by v) as q3
      from s group by ${keyNames.join(", ")}
    )
    select ${keyNames.map((c) => `q.${c}`).join(", ")}, q.n, q.mean, q.q1, q.median, q.q3,
      min(s.v) filter (where s.v >= ${lowFence}) as lo,
      max(s.v) filter (where s.v <= ${highFence}) as hi,
      count(*) filter (where s.v < ${lowFence} or s.v > ${highFence})::int as outlier_count,
      (array_agg(s.v) filter (where s.v < ${lowFence} or s.v > ${highFence}))[1:${OUTLIER_SAMPLE}] as outliers
    from q join s on ${join}
    group by ${keyNames.map((c) => `q.${c}`).join(", ")}, q.n, q.mean, q.q1, q.median, q.q3
    order by ${keyNames.map((c) => `q.${c}`).join(", ")}`;
  const res = await db.query<unknown[]>(sql, [], { rowMode: "array" });
  const k = splitBy.length;
  return {
    groups: groupRows(res.rows, k, (row) => ({
      n: row[k + 1] as number,
      mean: row[k + 2] as number,
      q1: row[k + 3] as number,
      median: row[k + 4] as number,
      q3: row[k + 5] as number,
      lo: row[k + 6] as number,
      hi: row[k + 7] as number,
      outlierCount: row[k + 8] as number,
      outliers: (row[k + 9] as number[] | null) ?? [],
    })).map((g) => ({
      values: g.values,
      categories: g.categories,
      boxes: g.items,
    })),
  };
}
