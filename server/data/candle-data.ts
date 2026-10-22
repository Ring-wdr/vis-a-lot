// candle 데이터. 전체 기간을 깔끔한 시간 간격으로 나눠, split 조합 × 구간마다 OHLC를 SQL로 집계한다.

import type { PGlite } from "@electric-sql/pglite";
import {
  columnOf,
  type DatasetSchema,
  ident,
  numericSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 고를 수 있는 구간 길이. 사람이 읽기 좋은 간격만 둔다. */
export const CANDLE_INTERVALS = [
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  60 * DAY,
  90 * DAY,
  180 * DAY,
  365 * DAY,
] as const;

/**
 * 구간 수 상한. 이보다 많아지지 않는 가장 짧은 간격을 고른다.
 * 이웃 간격의 비가 2.5배 이하라 기간이 충분하면 60~150개가 된다.
 */
export const MAX_CANDLES = 150;

/** 구간 경계를 KST 자정·정시에 맞춘다. */
const KST_OFFSET_MS = 9 * HOUR;

/** 전체 기간(ms)을 MAX_CANDLES개 이하로 나누는 가장 짧은 깔끔한 간격 */
export function candleInterval(span: number) {
  return (
    CANDLE_INTERVALS.find((i) => span / i <= MAX_CANDLES) ??
    CANDLE_INTERVALS[CANDLE_INTERVALS.length - 1]
  );
}

/** 시각 t가 든 구간의 시작 (KST 경계) */
export function bucketStart(t: number, interval: number) {
  return Math.floor((t + KST_OFFSET_MS) / interval) * interval - KST_OFFSET_MS;
}

export type CandleGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** 구간 시작 시각(epoch ms) 오름차순. 데이터가 없는 구간은 빠진다. */
  t: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  count: number[];
};

export type CandleData = {
  /** 구간 길이(ms). 모든 item이 같은 간격을 쓴다. */
  interval: number;
  groups: CandleGroup[];
};

export type CandleDataParams = {
  table: string;
  x: string;
  y: string;
  splitBy: string[];
  filters?: ChartFilter[];
};

export async function queryCandleData(
  db: PGlite,
  schema: DatasetSchema,
  { table, x, y, splitBy, filters }: CandleDataParams,
): Promise<CandleData> {
  const xCol = columnOf(schema, x, "datetime");
  const yCol = columnOf(schema, y, "numeric");
  const splitCols = splitBy.map((c) => columnOf(schema, c));
  const filter = filterSql(schema, filters);
  const t = `${numericSql(xCol)}::float8`;
  const v = `${ident(yCol.name)}::float8`;
  const where = `${ident(xCol.name)} is not null and ${ident(yCol.name)} is not null${filter.sql}`;

  // 구간 간격은 item마다가 아니라 전체 기간으로 정해, 어느 item이든 같은 간격으로 비교한다.
  const range = await db.query<{ lo: number | null; hi: number | null }>(
    `select min(${t}) as lo, max(${t}) as hi from ${table} where ${where}`,
    filter.params,
  );
  const lo = range.rows[0]?.lo ?? null;
  const hi = range.rows[0]?.hi ?? null;
  const interval = candleInterval(lo === null || hi === null ? 0 : hi - lo);

  const k = splitCols.length;
  const groups: CandleGroup[] = [];
  if (lo !== null) {
    const splitKeys = splitCols.map((c) => ident(c.name));
    const bucket = `floor((${t} + ${KST_OFFSET_MS}) / ${interval})`;
    const sql = `select ${[...splitCols.map(textSql), `${bucket} as b`].join(", ")},
        (array_agg(${v} order by ${t}, ctid))[1] as o,
        max(${v}) as h, min(${v}) as l,
        (array_agg(${v} order by ${t} desc, ctid desc))[1] as c,
        count(*)::int as n
      from ${table} where ${where}
      group by ${[...splitKeys, "b"].join(", ")}
      order by ${[...splitKeys, "b"].join(", ")}`;
    const res = await db.query<unknown[]>(sql, filter.params, {
      rowMode: "array",
    });
    let current: CandleGroup | undefined;
    for (const row of res.rows) {
      const values = row.slice(0, k) as string[];
      if (!current || values.some((s, j) => s !== current?.values[j])) {
        current = {
          values,
          t: [],
          open: [],
          high: [],
          low: [],
          close: [],
          count: [],
        };
        groups.push(current);
      }
      current.t.push((row[k] as number) * interval - KST_OFFSET_MS);
      current.open.push(row[k + 1] as number);
      current.high.push(row[k + 2] as number);
      current.low.push(row[k + 3] as number);
      current.close.push(row[k + 4] as number);
      current.count.push(row[k + 5] as number);
    }
  }
  // 조건에 맞는 행이 없어도 split 없는 차트는 빈 item 하나를 그린다.
  if (groups.length === 0 && k === 0) {
    groups.push({
      values: [],
      t: [],
      open: [],
      high: [],
      low: [],
      close: [],
      count: [],
    });
  }
  return { interval, groups };
}
