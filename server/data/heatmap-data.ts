// heatmap 데이터. x 범주(또는 시계열을 자동 시간 구간으로 묶은 값) × y 범주 칸마다 z를 통계 함수로 집계한다.
// 집계는 DB(PGlite)가 SQL로 하고, split 조합 단위로 [x][y] 칸을 채워 돌려준다.

import type { PGlite } from "@electric-sql/pglite";
import { utcFormat } from "d3-time-format";
import { AGG_SQL } from "./category-data";
import { queryLegendValues } from "./chart-data";
import {
  columnOf,
  type DatasetSchema,
  ident,
  numericSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import type { AggFn } from "./schema";

export type HeatmapGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** x 범주. 순서가 곧 x축 인덱스다. 시계열이면 구간 시작 시각의 글자다. */
  xCategories: string[];
  /** 시계열 x: 구간마다 시작 시각(epoch ms). 비어 있는 구간도 칸을 둔다. */
  xStarts?: number[];
  /** y 범주. 순서가 곧 y축 인덱스다 (전체 데이터의 정렬 순서를 따른다). */
  yCategories: string[];
  /** [x][y] 집계값. 그 칸에 데이터가 없으면 null */
  cells: (number | null)[][];
};

export type HeatmapData = {
  groups: HeatmapGroup[];
  /** 시계열 x를 묶은 구간 길이(ms). 범주 x면 없다. */
  timeBin?: number;
};

export type HeatmapDataParams = {
  /** 읽을 테이블 (데이터셋 하나) */
  table: string;
  x: string;
  y: string;
  z: string;
  agg: AggFn;
  splitBy: string[];
  filters?: ChartFilter[];
};

const KST_OFFSET_MS = 9 * 3_600_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 고를 수 있는 시간 구간. 보기 좋은 길이만 둔다. */
const TIME_BINS = [
  SECOND,
  5 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  7 * DAY,
  30 * DAY,
];

/** 시계열 x의 구간 수 상한. 칸이 너무 가늘면 읽을 수 없다. */
export const MAX_TIME_BINS = 48;

/** 구간 번호. 하루 이상 구간이 KST 자정에 맞도록 KST 기준으로 자른다. */
export function timeBinIndex(ms: number, bin: number) {
  return Math.floor((ms + KST_OFFSET_MS) / bin);
}

export function timeBinStart(index: number, bin: number) {
  return index * bin - KST_OFFSET_MS;
}

/** 범위를 maxBins개 이하의 구간으로 나누는 가장 짧은 보기 좋은 구간 길이 */
export function chooseTimeBin(
  min: number,
  max: number,
  maxBins = MAX_TIME_BINS,
) {
  return (
    TIME_BINS.find(
      (bin) => timeBinIndex(max, bin) - timeBinIndex(min, bin) + 1 <= maxBins,
    ) ?? TIME_BINS[TIME_BINS.length - 1]
  );
}

/** 구간 시작 시각의 글자. 구간이 짧을수록 자세히 적는다 (KST). */
export function timeBinLabel(start: number, bin: number) {
  const fmt = utcFormat(
    bin >= DAY
      ? "%m/%d"
      : bin >= HOUR
        ? "%m/%d %H시"
        : bin >= MINUTE
          ? "%H:%M"
          : "%H:%M:%S",
  );
  return fmt(new Date(start + KST_OFFSET_MS));
}

type Cell = [xKey: string, y: string, value: number];

/**
 * 정렬된 행(split…, x 키, y 범주, 값)을 split 조합 단위로 [x][y] 칸에 채운다.
 * yOrder는 전체 데이터의 y 정렬 순서다. 시계열이면 x 키가 구간 번호이고, 비어 있는 구간까지 칸을 둔다.
 */
export function groupHeatmapRows(
  rows: readonly unknown[][],
  k: number,
  yOrder: readonly string[],
  timeBin: number | undefined,
): HeatmapGroup[] {
  const yRank = new Map(yOrder.map((v, i) => [v, i]));
  const drafts: { values: string[]; cells: Cell[] }[] = [];
  let current: (typeof drafts)[number] | undefined;
  for (const row of rows) {
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = { values, cells: [] };
      drafts.push(current);
    }
    current.cells.push([
      String(row[k]),
      String(row[k + 1]),
      row[k + 2] as number,
    ]);
  }

  return drafts.map(({ values, cells }) => {
    // y는 이 item에 나온 값만, 전체 데이터의 정렬 순서대로 둔다.
    const ys = [...new Set(cells.map((c) => c[1]))].sort(
      (a, b) => (yRank.get(a) ?? 0) - (yRank.get(b) ?? 0),
    );
    const yIndex = new Map(ys.map((v, i) => [v, i]));
    let xKeys: string[];
    let xStarts: number[] | undefined;
    let xCategories: string[];
    if (timeBin !== undefined) {
      // 행이 x 키(구간 번호) 순으로 정렬되어 있어 처음과 끝이 범위다.
      const first = Number(cells[0][0]);
      const last = Number(cells[cells.length - 1][0]);
      const bins = Array.from(
        { length: last - first + 1 },
        (_, i) => first + i,
      );
      xKeys = bins.map(String);
      xStarts = bins.map((b) => timeBinStart(b, timeBin));
      xCategories = xStarts.map((s) => timeBinLabel(s, timeBin));
    } else {
      xKeys = [...new Set(cells.map((c) => c[0]))];
      xCategories = xKeys;
    }
    const xIndex = new Map(xKeys.map((v, i) => [v, i]));
    const grid = xKeys.map(() =>
      new Array<number | null>(ys.length).fill(null),
    );
    for (const [xKey, y, v] of cells) {
      const i = xIndex.get(timeBin !== undefined ? String(Number(xKey)) : xKey);
      const j = yIndex.get(y);
      if (i !== undefined && j !== undefined) grid[i][j] = v;
    }
    return {
      values,
      xCategories,
      ...(xStarts ? { xStarts } : {}),
      yCategories: ys,
      cells: grid,
    };
  });
}

/** x·y·z가 모두 있는 행만 센다. 시계열 x는 전체 범위로 구간 길이를 정해 모든 item이 같은 구간을 쓴다. */
export async function queryHeatmapData(
  db: PGlite,
  schema: DatasetSchema,
  params: HeatmapDataParams,
): Promise<HeatmapData> {
  const { table, agg, splitBy } = params;
  const xCol = columnOf(schema, params.x, "categorical", "datetime");
  const yCol = columnOf(schema, params.y, "categorical");
  const zCol = columnOf(schema, params.z, "numeric");
  const splitCols = splitBy.map((c) => columnOf(schema, c));
  const filter = filterSql(schema, params.filters);
  const where = `${ident(xCol.name)} is not null and ${ident(yCol.name)} is not null and ${ident(zCol.name)} is not null${filter.sql}`;

  let timeBin: number | undefined;
  let xKey: string;
  let xGroup: string;
  if (xCol.type === "datetime") {
    const range = await db.query<{ lo: number | null; hi: number | null }>(
      `select min(${numericSql(xCol)})::float8 as lo, max(${numericSql(xCol)})::float8 as hi
       from ${table} where ${where}`,
      filter.params,
    );
    const { lo, hi } = range.rows[0] ?? { lo: null, hi: null };
    timeBin = chooseTimeBin(lo ?? 0, hi ?? 0);
    xKey = `floor((${numericSql(xCol)} + ${KST_OFFSET_MS}) / ${timeBin})::float8`;
    xGroup = xKey;
  } else {
    // 정렬은 원래 타입 기준, 값은 text로 받는다.
    xKey = textSql(xCol);
    xGroup = ident(xCol.name);
  }
  const yOrder = await queryLegendValues(db, table, schema, yCol.name);
  const keys = [
    ...splitCols.map((c) => ident(c.name)),
    xGroup,
    ident(yCol.name),
  ];
  const select = [...splitCols.map(textSql), xKey, textSql(yCol)];
  const sql = `select ${select.join(", ")}, ${AGG_SQL[agg](ident(zCol.name))}::float8
    from ${table} where ${where}
    group by ${keys.join(", ")} order by ${keys.join(", ")}`;
  const res = await db.query<unknown[]>(sql, filter.params, {
    rowMode: "array",
  });
  const groups = groupHeatmapRows(res.rows, splitBy.length, yOrder, timeBin);
  // 조건에 맞는 행이 없어도 split 없는 차트는 빈 item 하나를 그린다.
  if (groups.length === 0 && splitBy.length === 0)
    groups.push({ values: [], xCategories: [], yCategories: [], cells: [] });
  return { groups, ...(timeBin !== undefined ? { timeBin } : {}) };
}
