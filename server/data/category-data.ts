// bar / boxplot 데이터. 집계는 DB(PGlite)가 SQL로 하고, split 조합 × x 범주 × legend 값 단위로 돌려준다.

import type { PGlite } from "@electric-sql/pglite";
import { queryLegendValues } from "./chart-data";
import { type ChartFilter, filterSql } from "./filters";
import {
  type AggFn,
  COLUMNS,
  type ColumnName,
  type LegendColumn,
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
  /** [범주][legend 값] 집계값. 그 조합에 데이터가 없으면 null. legend가 없으면 안쪽 길이는 1 */
  bars?: (number | null)[][];
  boxes?: (BoxStats | null)[][];
};

export type CategoryData = {
  groups: CategoryGroup[];
  /** legend 값 목록 (전체 데이터 기준). legend가 없으면 undefined */
  legendValues?: string[];
};

export type CategoryDataParams = {
  rows: RowSize;
  chartType: "bar" | "boxplot";
  x: ColumnName;
  y: ColumnName;
  agg: AggFn;
  splitBy: ColumnName[];
  legend: LegendColumn | null;
  filters?: ChartFilter[];
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
  const { x, y, splitBy, legend } = params;
  for (const name of [x, y, ...splitBy, ...(legend ? [legend] : [])]) {
    if (!COLUMN_TYPE.has(name)) throw new Error(`unknown column ${name}`);
  }
  if (COLUMN_TYPE.get(y) !== "number") throw new Error(`${y} is not numeric`);
}

/**
 * 정렬된 행(split…, 범주, [legend], 값…)을 split 조합 단위로 묶고,
 * 범주마다 legend 값 수만큼의 칸에 값을 채운다.
 */
function groupRows<T>(
  rows: unknown[][],
  k: number,
  legendValues: string[] | undefined,
  read: (row: unknown[], offset: number) => T,
) {
  const width = legendValues?.length ?? 1;
  const legendIndex = new Map(legendValues?.map((v, i) => [v, i]));
  const offset = k + 1 + (legendValues ? 1 : 0);
  const groups: {
    values: string[];
    categories: string[];
    cells: (T | null)[][];
  }[] = [];
  let current: (typeof groups)[number] | undefined;
  for (const row of rows) {
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = { values, categories: [], cells: [] };
      groups.push(current);
    }
    const category = String(row[k]);
    if (current.categories[current.categories.length - 1] !== category) {
      current.categories.push(category);
      current.cells.push(new Array<T | null>(width).fill(null));
    }
    const slot = legendValues ? (legendIndex.get(String(row[k + 1])) ?? 0) : 0;
    current.cells[current.cells.length - 1][slot] = read(row, offset);
  }
  return groups;
}

function keyColumns(params: CategoryDataParams) {
  const { splitBy, x, legend } = params;
  return [...splitBy, x, ...(legend ? [legend] : [])];
}

export async function queryBarData(
  db: PGlite,
  params: CategoryDataParams,
): Promise<CategoryData> {
  check(params);
  const { rows, y, agg, splitBy, legend } = params;
  const filter = filterSql(params.filters);
  const legendValues = legend
    ? await queryLegendValues(db, rows, legend)
    : undefined;
  const keys = keyColumns(params);
  const sql = `select ${keys.map((c) => `${c}::text`).join(", ")}, ${AGG_SQL[agg](y)}::float8
    from ${readingsTable(rows)} where ${y} is not null${filter.sql}
    group by ${keys.join(", ")} order by ${keys.join(", ")}`;
  const res = await db.query<unknown[]>(sql, filter.params, {
    rowMode: "array",
  });
  return {
    legendValues,
    groups: groupRows(
      res.rows,
      splitBy.length,
      legendValues,
      (row, o) => row[o] as number,
    ).map((g) => ({
      values: g.values,
      categories: g.categories,
      bars: g.cells,
    })),
  };
}

/** 사분위수는 percentile_cont, 수염은 1.5 IQR 안쪽의 최솟값/최댓값, 바깥은 이상치 */
export async function queryBoxData(
  db: PGlite,
  params: CategoryDataParams,
): Promise<CategoryData> {
  check(params);
  const { rows, y, splitBy, legend } = params;
  const filter = filterSql(params.filters);
  const legendValues = legend
    ? await queryLegendValues(db, rows, legend)
    : undefined;
  // 정렬은 원래 타입 기준, 결과 값은 text로 돌려받는다.
  const keyNames = keyColumns(params).map((c, i) => ({
    src: c,
    alias: `_k${i}`,
  }));
  const select = keyNames.map(
    (c) => `${c.src}::text as ${c.alias}, ${c.src} as ${c.alias}_o`,
  );
  const aliases = keyNames.map((c) => c.alias);
  const orderAliases = keyNames.map((c) => `q.${c.alias}_o`);
  const join = aliases.map((c) => `s.${c} = q.${c}`).join(" and ");
  const lowFence = "q.q1 - 1.5 * (q.q3 - q.q1)";
  const highFence = "q.q3 + 1.5 * (q.q3 - q.q1)";
  const sql = `
    with s as (
      select ${select.join(", ")}, ${y}::float8 as v
      from ${readingsTable(rows)} where ${y} is not null${filter.sql}
    ),
    q as (
      select ${aliases.join(", ")}, ${aliases.map((c) => `min(${c}_o) as ${c}_o`).join(", ")},
        count(*)::int as n, avg(v) as mean,
        percentile_cont(0.25) within group (order by v) as q1,
        percentile_cont(0.5) within group (order by v) as median,
        percentile_cont(0.75) within group (order by v) as q3
      from s group by ${aliases.join(", ")}
    )
    select ${aliases.map((c) => `q.${c}`).join(", ")}, q.n, q.mean, q.q1, q.median, q.q3,
      min(s.v) filter (where s.v >= ${lowFence}) as lo,
      max(s.v) filter (where s.v <= ${highFence}) as hi,
      count(*) filter (where s.v < ${lowFence} or s.v > ${highFence})::int as outlier_count,
      (array_agg(s.v) filter (where s.v < ${lowFence} or s.v > ${highFence}))[1:${OUTLIER_SAMPLE}] as outliers
    from q join s on ${join}
    group by ${aliases.map((c) => `q.${c}`).join(", ")}, ${orderAliases.join(", ")}, q.n, q.mean, q.q1, q.median, q.q3
    order by ${orderAliases.join(", ")}`;
  const res = await db.query<unknown[]>(sql, filter.params, {
    rowMode: "array",
  });
  return {
    legendValues,
    groups: groupRows(res.rows, splitBy.length, legendValues, (row, o) => ({
      n: row[o] as number,
      mean: row[o + 1] as number,
      q1: row[o + 2] as number,
      median: row[o + 3] as number,
      q3: row[o + 4] as number,
      lo: row[o + 5] as number,
      hi: row[o + 6] as number,
      outlierCount: row[o + 7] as number,
      outliers: (row[o + 8] as number[] | null) ?? [],
    })).map((g) => ({
      values: g.values,
      categories: g.categories,
      boxes: g.cells,
    })),
  };
}
