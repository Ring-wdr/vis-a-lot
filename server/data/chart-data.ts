// 차트 job 하나에 필요한 데이터를 한 번의 쿼리로 가져와 split 조합별로 나눈다.

import { sql } from "kysely";
import type { Db, Sql } from "../db/database";
import { queryArrays } from "../db/pglite-native";
import {
  allOf,
  columnOf,
  type DatasetSchema,
  ident,
  list,
  numericSql,
  tableSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";

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
  /** 행 식별자. ctid(블록, 오프셋)를 block * 65536 + offset 숫자로 인코딩했다. */
  ids: Float64Array;
  /** legend 값 목록(전체 데이터 기준)과 행별 legend 인덱스 */
  legend?: LegendData;
};

export type LegendData = { values: string[]; index: Uint8Array };

export type ChartDataParams = {
  /** 읽을 테이블 (데이터셋 하나) */
  table: string;
  x: string;
  y: string;
  splitBy: string[];
  legend: string | null;
  filters?: ChartFilter[];
};

/** ctid → 숫자. 테이블을 다시 만들기 전까지 행을 가리키는 값으로 안정적이다 (Postgres 계열 전용). */
const ROW_ID_EXPR = sql`((ctid::text::point)[0] * 65536 + (ctid::text::point)[1])::float8`;

/**
 * legend 값 목록. item마다가 아니라 전체 데이터 기준으로 정해야
 * 어느 item에서든 같은 값이 같은 색을 받는다 (색은 순위가 아니라 값을 따른다).
 */
export async function queryLegendValues(
  db: Db,
  table: string,
  schema: DatasetSchema,
  name: string,
): Promise<string[]> {
  const column = columnOf(schema, name, "categorical");
  const res = await sql<{
    v: string;
  }>`select distinct ${textSql(column)} as v, ${ident(column.name)} from ${tableSql(table)} order by ${ident(column.name)}`.execute(
    db,
  );
  return res.rows.map((r) => r.v);
}

export function rowIdToTid(id: number) {
  return `(${Math.floor(id / 65536)},${id % 65536})`;
}

/** 툴팁 추가 컬럼: 행 식별자로 한 행의 값들을 가져온다. 시각은 epoch ms로 돌려준다. */
export async function queryRowValues(
  db: Db,
  table: string,
  schema: DatasetSchema,
  rowId: number,
  names: string[],
): Promise<Record<string, string | number | null>> {
  if (names.length === 0) return {};
  const columns = names.map((n) => columnOf(schema, n));
  // 결과 키는 컬럼 순서대로 c0, c1 …로 받아 원래 이름으로 되돌린다 (이름에 무엇이 들어 있어도 된다).
  const select = list(
    columns.map((c, i) =>
      c.type === "datetime"
        ? sql`${numericSql(c)}::float8 as ${sql.id(`c${i}`)}`
        : sql`${ident(c.name)} as ${sql.id(`c${i}`)}`,
    ),
  );
  const res = await sql<
    Record<string, string | number | null>
  >`select ${select} from ${tableSql(table)} where ctid = ${rowIdToTid(rowId)}::tid`.execute(
    db,
  );
  const row = res.rows[0];
  if (!row) return {};
  return Object.fromEntries(
    columns.map((c, i) => [c.name, row[`c${i}`] ?? null]),
  );
}

/**
 * 쉼표로 이은 float8 글자 → 배열. Postgres는 float8을 다시 읽으면 같은 값이 되는 가장 짧은 글자로 내므로
 * 값이 바뀌지 않는다 (NaN·Infinity도 Number가 그대로 읽는다).
 */
function parseFloats(text: string | null, into: Float64Array, at: number) {
  if (!text) return 0;
  let start = 0;
  let n = 0;
  for (;;) {
    const end = text.indexOf(",", start);
    into[at + n++] = Number(
      end < 0 ? text.slice(start) : text.slice(start, end),
    );
    if (end < 0) return n;
    start = end + 1;
  }
}

/** 행 하나의 float8 값을 쉼표로 이어 붙인다. 같은 Agg 안의 집계는 행을 같은 순서로 받는다. */
const joined = (value: Sql) => sql`string_agg((${value})::text, ',')`;

/**
 * 점 차트(scatter·line) 데이터. 행마다 결과 행을 받으면 PGlite가 행 하나를 넘기고 읽는 비용(행당 수 µs)이
 * 쿼리 자체보다 커서, split 조합마다 한 행으로 묶고 x·y·행 id·legend 번호를 글자 하나로 이어 받는다.
 */
export async function queryChartData(
  db: Db,
  schema: DatasetSchema,
  { table, x, y, splitBy, legend, filters }: ChartDataParams,
): Promise<ChartData> {
  const xCol = columnOf(schema, x, "numeric", "datetime");
  const yCol = columnOf(schema, y, "numeric", "datetime");
  const splitCols = splitBy.map((c) => columnOf(schema, c));
  const legendValues = legend
    ? await queryLegendValues(db, table, schema, legend)
    : [];
  // legend 번호: 값 목록에서의 위치 (목록에 없으면 0). null 값도 목록의 null과 같은 번호를 받는다
  const legendIndex = legend
    ? sql`coalesce(array_position(array(select jsonb_array_elements_text(${JSON.stringify(legendValues)}::jsonb)), ${textSql(columnOf(schema, legend, "categorical"))}) - 1, 0)`
    : null;
  const select = [
    ...splitCols.map(textSql),
    sql`count(*)::int`,
    joined(sql`${numericSql(xCol)}::float8`),
    joined(sql`${numericSql(yCol)}::float8`),
    joined(ROW_ID_EXPR),
    ...(legendIndex ? [joined(legendIndex)] : []),
  ];
  const keys = list(splitCols.map((c) => ident(c.name)));
  const grouping =
    splitCols.length > 0 ? sql`group by ${keys} order by ${keys}` : sql``;
  const where = allOf([
    sql`${ident(xCol.name)} is not null`,
    sql`${ident(yCol.name)} is not null`,
    ...filterSql(schema, filters),
  ]);
  const rows = await queryArrays(
    db,
    sql`select ${list(select)} from ${tableSql(table)}
    where ${where} ${grouping}`,
  );
  const k = splitBy.length;
  const n = rows.reduce((sum, row) => sum + (row[k] as number), 0);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const ids = new Float64Array(n);
  const legendIndexes = new Uint8Array(legend ? n : 0);
  const legendScratch = legend ? new Float64Array(n) : undefined;
  const groups: SplitGroup[] = [];
  let at = 0;
  for (const row of rows) {
    const count = row[k] as number;
    // split 없이 맞는 행이 없으면 집계 결과가 count 0인 한 행이다
    if (count === 0) continue;
    parseFloats(row[k + 1] as string, xs, at);
    parseFloats(row[k + 2] as string, ys, at);
    parseFloats(row[k + 3] as string, ids, at);
    if (legendScratch) parseFloats(row[k + 4] as string, legendScratch, at);
    groups.push({
      values: row.slice(0, k) as string[],
      start: at,
      end: at + count,
    });
    at += count;
  }
  if (legendScratch) legendIndexes.set(legendScratch);
  // 조건에 맞는 행이 없어도 split 없는 차트는 빈 item 하나를 그린다.
  if (groups.length === 0 && k === 0)
    groups.push({ values: [], start: 0, end: 0 });
  return {
    groups,
    xs,
    ys,
    ids,
    legend: legend ? { values: legendValues, index: legendIndexes } : undefined,
  };
}
