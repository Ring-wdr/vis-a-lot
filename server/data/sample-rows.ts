// 전체 데이터 표: 데이터셋 전체를 draw 시점 필터로 거른 뒤 최대 SAMPLE_ROWS행만 샘플로 보여준다.
// 수백만 행을 다 보여주면 DB 부하가 크므로 tablesample로 고르고, seed를 고정해 페이지·정렬이 바뀌어도
// 같은 샘플을 쓴다.

import type { PGlite } from "@electric-sql/pglite";
import type { DatasetSchema } from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import { columnsOf, type ItemRowsColumn, orderOf, selectOf } from "./item-rows";

export const SAMPLE_ROWS = 30_000;
/** 고정 seed. 같은 데이터·필터면 언제 열어도 같은 행을 고른다. */
const SAMPLE_SEED = 20261022;
/** bernoulli는 비율대로 무작위로 고르므로 모자라지 않게 조금 더 뽑고 앞에서 자른다. */
const OVERSAMPLE = 1.1;

export type SampleRowsPage = {
  columns: ItemRowsColumn[];
  rows: (string | number | null)[][];
  /** 샘플 안의 행 수 (최대 SAMPLE_ROWS) */
  total: number;
  /** 필터에 맞는 전체 행 수 */
  population: number;
  /** 전체가 SAMPLE_ROWS보다 많아 샘플로 줄였는지 */
  sampled: boolean;
};

/** 필터에 맞는 행 수로 뽑을 비율(%)을 정한다. 전체가 상한 이하면 샘플링하지 않는다. */
export function samplePercent(population: number) {
  if (population <= SAMPLE_ROWS) return null;
  return Math.min(100, ((SAMPLE_ROWS * OVERSAMPLE) / population) * 100);
}

export async function querySampleRows(
  db: PGlite,
  table: string,
  schema: DatasetSchema,
  filters: ChartFilter[] | undefined,
  page: {
    offset: number;
    limit: number;
    sort?: { column: string; desc: boolean };
  },
): Promise<SampleRowsPage> {
  const columns = columnsOf(
    schema,
    schema.columns.map((c) => c.name),
  );
  const filter = filterSql(schema, filters);
  const where = `true${filter.sql}`;
  const count = await db.query<{ n: number }>(
    `select count(*)::int as n from ${table} where ${where}`,
    filter.params,
  );
  const population = count.rows[0]?.n ?? 0;
  const percent = samplePercent(population);
  const source =
    percent === null
      ? table
      : `${table} tablesample bernoulli (${percent}) repeatable (${SAMPLE_SEED})`;
  // 넉넉히 뽑은 행을 저장 순서로 자르면 뒤쪽 행이 빠지므로, 행 위치의 해시 순으로 SAMPLE_ROWS행을 고른다.
  // 해시는 결정적이라 같은 샘플이 나오고, 그 안에서 정렬·페이지를 나눈다.
  const sample = `select ctid as _ctid, * from ${source} where ${where}
    order by md5(ctid::text) limit ${SAMPLE_ROWS}`;
  const order = orderOf(schema, page.sort).replace(/\bctid\b/, "_ctid");
  const [rows, size] = await Promise.all([
    db.query<unknown[]>(
      `with s as (${sample}) select ${selectOf(columns)} from s
       order by ${order} limit ${Math.trunc(page.limit)} offset ${Math.trunc(page.offset)}`,
      filter.params,
      { rowMode: "array" },
    ),
    db.query<{ n: number }>(
      `with s as (${sample}) select count(*)::int as n from s`,
      filter.params,
    ),
  ]);
  return {
    columns: columns.map(({ name, label, type }) => ({ name, label, type })),
    rows: rows.rows as (string | number | null)[][],
    total: size.rows[0]?.n ?? 0,
    population,
    sampled: percent !== null,
  };
}
