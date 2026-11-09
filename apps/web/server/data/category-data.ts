// bar / boxplot 데이터. 집계는 DB(PGlite)가 SQL로 하고, split 조합 × x 범주 × legend 값 단위로 돌려준다.

import { sql } from "kysely";
import type { Db, Sql } from "../db/database";
import { queryArrays } from "../db/pglite-native";
import { queryLegendValues } from "./chart-data";
import {
  allOf,
  type ColumnSchema,
  columnOf,
  type DatasetSchema,
  ident,
  list,
  tableSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import type { AggFn } from "./schema";

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
  /** boxplot 하위 차트 dot: 상자 위에 겹쳐 찍을 원값 표본 (최대 DOT_SAMPLE개). 요청하지 않으면 없다. */
  dots?: number[];
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
  /** 읽을 테이블 (데이터셋 하나) */
  table: string;
  /** waterfall은 bar와 같은 집계(legend 없이)를 쓰고 누적은 렌더러가 한다. funnel은 funnel-data가 줄 세운다. */
  chartType: "bar" | "boxplot" | "waterfall" | "funnel";
  x: string;
  y: string;
  agg: AggFn;
  splitBy: string[];
  legend: string | null;
  filters?: ChartFilter[];
  /** boxplot: 상자마다 원값 표본(dots)도 가져온다 */
  dots?: boolean;
};
const OUTLIER_SAMPLE = 200;
/** dot boxplot에서 상자 하나에 찍는 점 수의 상한 */
export const DOT_SAMPLE = 300;

/** 통계 함수 조각. median의 percentile_cont … within group은 Postgres 계열 전용이다. */
export const AGG_SQL: Record<AggFn, (y: Sql) => Sql> = {
  avg: (y) => sql`avg(${y})`,
  sum: (y) => sql`sum(${y})`,
  count: () => sql`count(*)`,
  min: (y) => sql`min(${y})`,
  max: (y) => sql`max(${y})`,
  median: (y) => sql`percentile_cont(0.5) within group (order by ${y})`,
};

/** x는 범주, y는 숫자. split·legend 컬럼까지 스키마에서 확인해 꺼낸다. */
function columnsOf(schema: DatasetSchema, params: CategoryDataParams) {
  return {
    x: columnOf(schema, params.x, "categorical"),
    y: columnOf(schema, params.y, "numeric"),
    split: params.splitBy.map((c) => columnOf(schema, c)),
    legend: params.legend
      ? columnOf(schema, params.legend, "categorical")
      : undefined,
  };
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

/** 묶는 순서: split…, x 범주, [legend] */
function keyColumns(cols: ReturnType<typeof columnsOf>): ColumnSchema[] {
  return [...cols.split, cols.x, ...(cols.legend ? [cols.legend] : [])];
}

export async function queryBarData(
  db: Db,
  schema: DatasetSchema,
  params: CategoryDataParams,
): Promise<CategoryData> {
  const cols = columnsOf(schema, params);
  const { table, agg, splitBy, legend } = params;
  const y = ident(cols.y.name);
  const where = allOf([
    sql`${y} is not null`,
    ...filterSql(schema, params.filters),
  ]);
  const legendValues = legend
    ? await queryLegendValues(db, table, schema, legend)
    : undefined;
  const keys = keyColumns(cols);
  const keyNames = list(keys.map((c) => ident(c.name)));
  const rows = await queryArrays(
    db,
    sql`select ${list(keys.map(textSql))}, ${AGG_SQL[agg](y)}::float8
    from ${tableSql(table)} where ${where}
    group by ${keyNames} order by ${keyNames}`,
  );
  return {
    legendValues,
    groups: groupRows(
      rows,
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

/** 사분위수는 percentile_cont, 수염은 1.5 IQR 안쪽의 최솟값/최댓값, 바깥은 이상치 (Postgres 계열 전용) */
export async function queryBoxData(
  db: Db,
  schema: DatasetSchema,
  params: CategoryDataParams,
): Promise<CategoryData> {
  const cols = columnsOf(schema, params);
  const { table, splitBy, legend } = params;
  const y = ident(cols.y.name);
  const where = allOf([
    sql`${y} is not null`,
    ...filterSql(schema, params.filters),
  ]);
  const legendValues = legend
    ? await queryLegendValues(db, table, schema, legend)
    : undefined;
  // 정렬은 원래 타입 기준, 결과 값은 text로 돌려받는다.
  const keyNames = keyColumns(cols).map((c, i) => ({
    src: c,
    alias: `_k${i}`,
  }));
  const select = keyNames.map(
    (c) =>
      sql`${textSql(c.src)} as ${sql.id(c.alias)}, ${ident(c.src.name)} as ${sql.id(`${c.alias}_o`)}`,
  );
  // dot 표본: 행 위치(ctid)의 해시 순으로 앞에서 DOT_SAMPLE개. 같은 데이터면 늘 같은 점을 고른다 (Postgres 계열 전용).
  const dotHash = params.dots ? sql`, hashtext(ctid::text) as h` : sql``;
  const dotSelect = params.dots
    ? sql`, (array_agg(s.v order by s.h))[1:${sql.lit(DOT_SAMPLE)}] as dots`
    : sql``;
  const aliases = keyNames.map((c) => sql.id(c.alias));
  const qAliases = list(keyNames.map((c) => sql.id("q", c.alias)));
  const orderAliases = list(keyNames.map((c) => sql.id("q", `${c.alias}_o`)));
  const join = allOf(
    keyNames.map((c) => sql`${sql.id("s", c.alias)} = ${sql.id("q", c.alias)}`),
  );
  const lowFence = sql`q.q1 - 1.5 * (q.q3 - q.q1)`;
  const highFence = sql`q.q3 + 1.5 * (q.q3 - q.q1)`;
  const rows = await queryArrays(
    db,
    sql`
    with s as (
      select ${list(select)}, ${y}::float8 as v${dotHash}
      from ${tableSql(table)} where ${where}
    ),
    q as (
      select ${list(aliases)}, ${list(keyNames.map((c) => sql`min(${sql.id(`${c.alias}_o`)}) as ${sql.id(`${c.alias}_o`)}`))},
        count(*)::int as n, avg(v) as mean,
        percentile_cont(0.25) within group (order by v) as q1,
        percentile_cont(0.5) within group (order by v) as median,
        percentile_cont(0.75) within group (order by v) as q3
      from s group by ${list(aliases)}
    )
    select ${qAliases}, q.n, q.mean, q.q1, q.median, q.q3,
      min(s.v) filter (where s.v >= ${lowFence}) as lo,
      max(s.v) filter (where s.v <= ${highFence}) as hi,
      count(*) filter (where s.v < ${lowFence} or s.v > ${highFence})::int as outlier_count,
      (array_agg(s.v) filter (where s.v < ${lowFence} or s.v > ${highFence}))[1:${sql.lit(OUTLIER_SAMPLE)}] as outliers${dotSelect}
    from q join s on ${join}
    group by ${qAliases}, ${orderAliases}, q.n, q.mean, q.q1, q.median, q.q3
    order by ${orderAliases}`,
  );
  return {
    legendValues,
    groups: groupRows(rows, splitBy.length, legendValues, (row, o) => ({
      n: row[o] as number,
      mean: row[o + 1] as number,
      q1: row[o + 2] as number,
      median: row[o + 3] as number,
      q3: row[o + 4] as number,
      lo: row[o + 5] as number,
      hi: row[o + 6] as number,
      outlierCount: row[o + 7] as number,
      outliers: (row[o + 8] as number[] | null) ?? [],
      ...(params.dots ? { dots: (row[o + 9] as number[] | null) ?? [] } : {}),
    })).map((g) => ({
      values: g.values,
      categories: g.categories,
      boxes: g.cells,
    })),
  };
}
