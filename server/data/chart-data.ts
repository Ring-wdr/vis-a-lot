// 차트 job 하나에 필요한 데이터를 한 번의 쿼리로 가져와 split 조합별로 나눈다.

import type { PGlite } from "@electric-sql/pglite";
import { type ChartFilter, filterSql } from "./filters";
import {
  COLUMNS,
  type ColumnName,
  isLegendColumn,
  type LegendColumn,
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
  /** 행 식별자. ctid(블록, 오프셋)를 block * 65536 + offset 숫자로 인코딩했다. */
  ids: Float64Array;
  /** legend 값 목록(전체 데이터 기준)과 행별 legend 인덱스 */
  legend?: LegendData;
};

export type LegendData = { values: string[]; index: Uint8Array };

export type ChartDataParams = {
  rows: RowSize;
  x: ColumnName;
  y: ColumnName;
  splitBy: ColumnName[];
  legend: LegendColumn | null;
  filters?: ChartFilter[];
};

const COLUMN_TYPE = new Map(COLUMNS.map((c) => [c.name, c.type]));

/** ctid → 숫자. 테이블을 다시 만들기 전까지 행을 가리키는 값으로 안정적이다. */
const ROW_ID_EXPR =
  "((ctid::text::point)[0] * 65536 + (ctid::text::point)[1])::float8";

/**
 * legend 값 목록. item마다가 아니라 전체 데이터 기준으로 정해야
 * 어느 item에서든 같은 값이 같은 색을 받는다 (색은 순위가 아니라 값을 따른다).
 */
export async function queryLegendValues(
  db: PGlite,
  rows: RowSize,
  column: LegendColumn,
): Promise<string[]> {
  if (!isLegendColumn(column)) throw new Error(`${column} cannot be a legend`);
  const res = await db.query<{ v: string }>(
    `select distinct ${column}::text as v, ${column} from ${readingsTable(rows)} order by ${column}`,
  );
  return res.rows.map((r) => r.v);
}

export function rowIdToTid(id: number) {
  return `(${Math.floor(id / 65536)},${id % 65536})`;
}

/** 툴팁 추가 컬럼: 행 식별자로 한 행의 값들을 가져온다. 시계열은 epoch ms로 돌려준다. */
export async function queryRowValues(
  db: PGlite,
  rows: RowSize,
  rowId: number,
  columns: ColumnName[],
): Promise<Record<string, string | number | null>> {
  for (const name of columns) {
    if (!COLUMN_TYPE.has(name)) throw new Error(`unknown column ${name}`);
  }
  if (columns.length === 0) return {};
  const select = columns
    .map((c) =>
      COLUMN_TYPE.get(c) === "time"
        ? `(extract(epoch from ${c}) * 1000)::float8 as ${c}`
        : c,
    )
    .join(", ");
  const res = await db.query<Record<string, string | number | null>>(
    `select ${select} from ${readingsTable(rows)} where ctid = $1::tid`,
    [rowIdToTid(rowId)],
  );
  return res.rows[0] ?? {};
}

/** 숫자 축으로 쓸 값. 시계열은 epoch ms로 바꾼다. */
function numericExpr(name: ColumnName) {
  const type = COLUMN_TYPE.get(name);
  if (type === "time") return `extract(epoch from ${name}) * 1000`;
  if (type === "number") return name;
  throw new Error(`column ${name} is not numeric`);
}

export async function queryChartData(
  db: PGlite,
  { rows, x, y, splitBy, legend, filters }: ChartDataParams,
): Promise<ChartData> {
  for (const name of [x, y, ...splitBy]) {
    if (!COLUMN_TYPE.has(name)) throw new Error(`unknown column ${name}`);
  }
  const split = splitBy.map((c) => `${c}::text`);
  const select = [
    ...split,
    `${numericExpr(x)}::float8`,
    `${numericExpr(y)}::float8`,
    ROW_ID_EXPR,
    ...(legend ? [`${legend}::text`] : []),
  ];
  const legendValues = legend ? await queryLegendValues(db, rows, legend) : [];
  const legendIndexOf = new Map(legendValues.map((v, i) => [v, i]));
  const order = splitBy.length > 0 ? `order by ${splitBy.join(", ")}` : "";
  const filter = filterSql(filters);
  const sql = `select ${select.join(", ")} from ${readingsTable(rows)}
    where ${x} is not null and ${y} is not null${filter.sql} ${order}`;

  const res = await db.query<unknown[]>(sql, filter.params, {
    rowMode: "array",
  });
  const n = res.rows.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const ids = new Float64Array(n);
  const legendIndex = new Uint8Array(legend ? n : 0);
  const groups: SplitGroup[] = [];
  const k = splitBy.length;
  let current: SplitGroup | undefined;

  for (let i = 0; i < n; i++) {
    const row = res.rows[i];
    xs[i] = row[k] as number;
    ys[i] = row[k + 1] as number;
    ids[i] = row[k + 2] as number;
    if (legend) legendIndex[i] = legendIndexOf.get(row[k + 3] as string) ?? 0;
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
  return {
    groups,
    xs,
    ys,
    ids,
    legend: legend ? { values: legendValues, index: legendIndex } : undefined,
  };
}
