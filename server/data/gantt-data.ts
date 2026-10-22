// gantt 데이터. y 범주(작업 행)마다 시간순으로, legend 값이 같은 채로 이어지는 행들을 막대 하나로 묶는다
// (gaps-and-islands: 행 전체 순번 - legend 값별 순번이 같으면 한 구간). 묶기는 DB(PGlite)가 window 함수로 한다.
// legend가 없으면 행마다 처음~마지막 시각 막대 하나다.

import { sql } from "kysely";
import type { Db } from "../db/database";
import { queryArrays } from "../db/pglite-native";
import { queryLegendValues } from "./chart-data";
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

/** 막대 목록. 행 번호 → 시작 시각 순으로 정렬돼 있다. */
export type GanttBars = {
  /** 행 번호 (rows의 인덱스) */
  r: number[];
  /** 시작·끝 시각 (epoch ms) */
  s: number[];
  e: number[];
  /** legend 인덱스. legend가 없으면 0 */
  g: number[];
  /** 막대에 든 행 수 */
  n: number[];
};

export type GanttGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** y 범주(작업 행). 순서가 곧 위에서부터의 행 순서다. */
  rows: string[];
  bars: GanttBars;
};

export type GanttData = {
  groups: GanttGroup[];
  /** legend 값 목록 (전체 데이터 기준). legend가 없으면 undefined */
  legendValues?: string[];
};

export type GanttDataParams = {
  table: string;
  x: string;
  y: string;
  splitBy: string[];
  legend: string | null;
  filters?: ChartFilter[];
};

/** 정렬된 행(split…, 행, legend, 시작, 끝, 개수)을 split 조합과 행 번호로 묶는다. */
export function groupGanttRows(
  rows: unknown[][],
  k: number,
  legendValues: string[] | undefined,
): GanttGroup[] {
  const legendIndex = new Map(legendValues?.map((v, i) => [v, i]));
  const groups: GanttGroup[] = [];
  let current: GanttGroup | undefined;
  for (const row of rows) {
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = {
        values,
        rows: [],
        bars: { r: [], s: [], e: [], g: [], n: [] },
      };
      groups.push(current);
    }
    const name = String(row[k]);
    if (current.rows[current.rows.length - 1] !== name) current.rows.push(name);
    current.bars.r.push(current.rows.length - 1);
    current.bars.g.push(legendIndex.get(row[k + 1] as string) ?? 0);
    current.bars.s.push(row[k + 2] as number);
    current.bars.e.push(row[k + 3] as number);
    current.bars.n.push(row[k + 4] as number);
  }
  return groups;
}

export async function queryGanttData(
  db: Db,
  schema: DatasetSchema,
  { table, x, y, splitBy, legend, filters }: GanttDataParams,
): Promise<GanttData> {
  const xCol = columnOf(schema, x, "datetime");
  const yCol = columnOf(schema, y, "categorical");
  const legendCol = legend
    ? columnOf(schema, legend, "categorical")
    : undefined;
  const splitCols = splitBy.map((c) => columnOf(schema, c));
  const where = allOf([
    sql`${ident(xCol.name)} is not null`,
    sql`${ident(yCol.name)} is not null`,
    ...filterSql(schema, filters),
  ]);
  const legendValues = legendCol
    ? await queryLegendValues(db, table, schema, legendCol.name)
    : undefined;

  // split은 원래 타입으로 묶고 정렬한 뒤 결과만 text로 돌려받는다.
  // 구간 묶기(window 함수 row_number·lead)는 Postgres 계열 전용 문법 그대로 둔다.
  const split = splitCols.map((_, i) => sql.id(`_s${i}`));
  const part = list([...split, sql`r`]);
  const rows = await queryArrays(
    db,
    sql`
    with s as (
      select ${list([
        ...splitCols.map((c, i) => sql`${ident(c.name)} as ${split[i]}`),
        sql`${textSql(yCol)} as r`,
        sql`${legendCol ? textSql(legendCol) : sql`null::text`} as g`,
        sql`${numericSql(xCol)}::float8 as t`,
        sql`ctid as id`,
      ])}
      from ${tableSql(table)}
      where ${where}
    ),
    w as (
      select *,
        row_number() over (partition by ${part} order by t, id)
          - row_number() over (partition by ${part}, g order by t, id) as island
      from s
    ),
    i as (
      select ${part}, g, min(t) as st, max(t) as mt, count(*)::int as n
      from w group by ${part}, g${legendCol ? sql`, island` : sql``}
    )
    select ${list([...split.map((c) => sql`${c}::text`), sql`r`, sql`g`])}, st,
      ${
        // 상태는 다음 구간이 시작될 때까지 이어진 것으로 보고 끝을 다음 시작에 붙인다. 마지막 구간은 마지막 시각까지.
        legendCol
          ? sql`coalesce(lead(st) over (partition by ${part} order by st), mt)`
          : sql`mt`
      } as en, n
    from i order by ${part}, st`,
  );
  const groups = groupGanttRows(rows, splitCols.length, legendValues);
  // 조건에 맞는 행이 없어도 split 없는 차트는 빈 item 하나를 그린다.
  if (groups.length === 0 && splitCols.length === 0) {
    groups.push({
      values: [],
      rows: [],
      bars: { r: [], s: [], e: [], g: [], n: [] },
    });
  }
  return { groups, legendValues };
}
