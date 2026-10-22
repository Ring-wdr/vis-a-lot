// item 하나가 그린 행: split 조합 + 필터 + (scatter) 지운 영역 밖 + 선택이 있으면 선택 영역 안.
// 데이터 표(페이지 단위·정렬)와 데이터 다운로드(CSV 전체)가 같은 조건을 쓴다.

import { sql } from "kysely";
import type { ChartType } from "../api/types";
import { CHART_FIELDS, POINT_CHARTS } from "../charts/chart-fields";
import type { Db, Sql } from "../db/database";
import { copyTo, queryArrays } from "../db/pglite-native";
import type { Region } from "../render/region";
import {
  allOf,
  type ColumnSchema,
  columnOf,
  type DatasetSchema,
  ident,
  list,
  numericSql,
  tableSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import { binSql, type HistogramBins } from "./histogram-data";

export type ItemRowsScope = {
  chartType: ChartType;
  x: string;
  /** null이면 y를 쓰지 않는 차트다 (histogram) */
  y: string | null;
  legend: string | null;
  splitBy: string[];
  /** split 컬럼 순서대로의 값 (이 item의 조합) */
  splitValues: string[];
  /** 결과에 넣을 컬럼 (차트에 쓴 컬럼) */
  columns: string[];
  filters?: ChartFilter[];
  /** scatter·line: 지운 영역. 안의 행은 뺀다. */
  deletions: Region[];
  /** scatter·line: 선택 영역. 있으면 안의 행만 */
  selection?: Region;
  /** bar/boxplot: 선택된 막대/상자 [범주, legend 값]. 있으면 이 조합의 행만 */
  selectedMarks?: [string, string | null][];
  /** histogram: 선택된 막대 [구간 번호, legend 값]. 구간은 렌더와 같은 정의로 다시 센다. */
  selectedBins?: { bins: HistogramBins; marks: [number, string | null][] };
  /** legend 체크박스로 끈 값 */
  hiddenLegend?: string[];
};

export type ItemRowsColumn = Pick<ColumnSchema, "name" | "label" | "type">;

export type ItemRowsPage = {
  columns: ItemRowsColumn[];
  /** 컬럼 순서대로의 값. 시각은 epoch ms */
  rows: (string | number | null)[][];
  total: number;
};

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** 영역 → Postgres 기하 값 조각. 사각형은 box, 자유형은 polygon이다 (Postgres 계열 전용). */
function geometrySql(region: Region): Sql {
  if (region.type === "rect") {
    const text = `((${num(region.x0)},${num(region.y0)}),(${num(region.x1)},${num(region.y1)}))`;
    return sql`${text}::box`;
  }
  const text = `(${region.points.map(([x, y]) => `(${num(x)},${num(y)})`).join(",")})`;
  return sql`${text}::polygon`;
}

/** where 조건 조각. 컬럼은 스키마로 확인해 인용하고, 값은 모두 바인딩으로 넣는다. */
export function itemRowsWhere(
  schema: DatasetSchema,
  scope: ItemRowsScope,
): Sql {
  const parts: Sql[] = [];
  const scatter = POINT_CHARTS.includes(scope.chartType);
  const xCol = columnOf(schema, scope.x, ...CHART_FIELDS[scope.chartType].x);
  const yCol =
    scope.y === null
      ? undefined
      : columnOf(schema, scope.y, "numeric", "datetime");
  if (yCol) parts.push(sql`${ident(yCol.name)} is not null`);
  // 값 축(숫자·시계열) x는 값이 없으면 그리지 않은 행이다. 범주 x는 null도 범주 하나로 센다.
  if (xCol.type !== "categorical")
    parts.push(sql`${ident(xCol.name)} is not null`);

  scope.splitBy.forEach((name, i) => {
    const column = columnOf(schema, name);
    const value = scope.splitValues[i];
    parts.push(
      value === undefined || value === null
        ? sql`${ident(column.name)} is null`
        : sql`${textSql(column)} = ${value}`,
    );
  });

  const legendCol = scope.legend
    ? columnOf(schema, scope.legend, "categorical")
    : undefined;
  if (legendCol && scope.hiddenLegend?.length) {
    parts.push(
      sql`${textSql(legendCol)} not in (select jsonb_array_elements_text(${JSON.stringify(scope.hiddenLegend)}::jsonb))`,
    );
  }

  if (scatter && yCol) {
    const point = sql`point(${numericSql(xCol)}::float8, ${numericSql(yCol)}::float8)`;
    for (const region of scope.deletions) {
      parts.push(sql`not (${point} <@ ${geometrySql(region)})`);
    }
    if (scope.selection) {
      parts.push(sql`${point} <@ ${geometrySql(scope.selection)}`);
    }
  } else if (scope.selectedBins) {
    const { bins, marks } = scope.selectedBins;
    const bin = binSql(ident(xCol.name), bins);
    const key = legendCol
      ? sql`(${bin}::text || chr(31) || coalesce(${textSql(legendCol)}, ''))`
      : sql`${bin}::text`;
    const keys = marks.map(([b, legend]) =>
      legendCol ? `${b}\u001f${legend ?? ""}` : String(b),
    );
    parts.push(
      sql`${key} in (select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))`,
    );
  } else if (scope.selectedMarks) {
    // 범주와 legend 값을 한 글자(\u001f)로 이어 붙인 키로 비교한다.
    const key = legendCol
      ? sql`(${textSql(xCol)} || chr(31) || coalesce(${textSql(legendCol)}, ''))`
      : textSql(xCol);
    const keys = scope.selectedMarks.map(([category, legend]) =>
      legendCol ? `${category}\u001f${legend ?? ""}` : category,
    );
    parts.push(
      sql`${key} in (select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))`,
    );
  }

  // 조건이 하나도 없을 수 있다(split·필터 없는 pie 등). 그래도 where 절이 깨지지 않게 true에서 시작한다.
  return allOf([sql`true`, ...parts, ...filterSql(schema, scope.filters)]);
}

/** 결과 컬럼: 이름이 겹치면 한 번만, 스키마 순서가 아니라 고른 순서대로 */
export function columnsOf(schema: DatasetSchema, names: string[]) {
  return [...new Set(names)].map((n) => columnOf(schema, n));
}

/** 표 값: 시각은 epoch ms 숫자로, 숫자는 숫자로, 나머지는 글자로 */
export function selectOf(columns: ColumnSchema[]): Sql {
  return list(
    columns.map((c, i) => {
      const alias = sql.id(`c${i}`);
      return c.type === "datetime"
        ? sql`${numericSql(c)}::float8 as ${alias}`
        : c.type === "numeric"
          ? sql`${ident(c.name)}::float8 as ${alias}`
          : sql`${textSql(c)} as ${alias}`;
    }),
  );
}

/**
 * 정렬 컬럼이 같으면 저장된 순서(rowOrder, 기본 ctid)로 이어 정렬해 페이지가 겹치지 않게 한다.
 * ctid는 Postgres 계열 전용 행 위치다.
 */
export function orderOf(
  schema: DatasetSchema,
  sort: { column: string; desc: boolean } | undefined,
  rowOrder: Sql = sql`ctid`,
): Sql {
  return sort
    ? sql`${ident(columnOf(schema, sort.column).name)} ${sql.raw(sort.desc ? "desc" : "asc")} nulls last, ${rowOrder}`
    : rowOrder;
}

/** 데이터 표 한 페이지. sort가 없으면 저장된 순서(ctid)대로 */
export async function queryItemRows(
  db: Db,
  table: string,
  schema: DatasetSchema,
  scope: ItemRowsScope,
  page: {
    offset: number;
    limit: number;
    sort?: { column: string; desc: boolean };
  },
): Promise<ItemRowsPage> {
  const columns = columnsOf(schema, scope.columns);
  const where = itemRowsWhere(schema, scope);
  const order = orderOf(schema, page.sort);
  const from = tableSql(table);
  const [rows, count] = await Promise.all([
    queryArrays<(string | number | null)[]>(
      db,
      sql`select ${selectOf(columns)} from ${from} where ${where}
       order by ${order} limit ${sql.lit(Math.trunc(page.limit))} offset ${sql.lit(Math.trunc(page.offset))}`,
    ),
    sql<{
      n: number;
    }>`select count(*)::int as n from ${from} where ${where}`.execute(db),
  ]);
  return {
    columns: columns.map(({ name, label, type }) => ({ name, label, type })),
    rows,
    total: count.rows[0]?.n ?? 0,
  };
}

/** 데이터 다운로드: 조건에 맞는 모든 행을 CSV(머리글 = 컬럼 라벨)로 */
export async function exportItemRows(
  db: Db,
  table: string,
  schema: DatasetSchema,
  scope: ItemRowsScope,
): Promise<Blob> {
  const columns = columnsOf(schema, scope.columns);
  const where = itemRowsWhere(schema, scope);
  const select = list(
    columns.map((c) => sql`${ident(c.name)} as ${ident(c.label)}`),
  );
  // COPY는 바인딩을 받지 않으므로 copyTo가 값을 SQL 글자로 넣어 컴파일한다.
  return copyTo(
    db,
    sql`select ${select} from ${tableSql(table)} where ${where} order by ctid`,
  );
}
