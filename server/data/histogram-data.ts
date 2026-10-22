// histogram 데이터. x 숫자 컬럼 하나의 분포를 구간별 개수로 센다.
// 구간은 (필터를 건) 전체 데이터 범위에서 한 번 정해 모든 split item이 같은 구간을 쓴다.
// 그래야 item끼리 막대 위치와 폭이 같아 나란히 비교할 수 있다.

import type { PGlite } from "@electric-sql/pglite";
import { queryLegendValues } from "./chart-data";
import { columnOf, type DatasetSchema, ident, textSql } from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";

/** 구간: lo부터 step 간격으로 count개. 마지막 구간만 끝값(hi)을 포함한다. */
export type HistogramBins = { lo: number; step: number; count: number };

export type HistogramGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** [구간][legend 값] 개수. legend가 없으면 안쪽 길이는 1 */
  counts: number[][];
};

export type HistogramData = {
  bins: HistogramBins;
  groups: HistogramGroup[];
  /** legend 값 목록 (전체 데이터 기준). legend가 없으면 undefined */
  legendValues?: string[];
};

export type HistogramDataParams = {
  table: string;
  x: string;
  splitBy: string[];
  legend: string | null;
  filters?: ChartFilter[];
};

/** 구간 수 목표. 이 근처(대략 20~40개)가 되는 보기 좋은 폭을 고른다. */
export const TARGET_BINS = 30;
const NICE_FACTORS = [1, 2, 2.5, 5, 10];

/**
 * 데이터 범위 → 보기 좋은 구간. 폭은 10^k × (1, 2, 2.5, 5) 중 구간 수가 목표에 가장 가까운 것이고,
 * 시작·끝은 그 폭의 배수로 맞춘다. 값이 하나뿐이면 그 값을 가운데 둔 구간 하나다.
 */
export function histogramBins(
  min: number,
  max: number,
  target = TARGET_BINS,
): HistogramBins {
  if (!Number.isFinite(min) || !Number.isFinite(max))
    return { lo: 0, step: 1, count: 1 };
  if (min === max) {
    const step = min === 0 ? 1 : 10 ** Math.floor(Math.log10(Math.abs(min)));
    return { lo: min - step / 2, step, count: 1 };
  }
  const raw = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  let best: HistogramBins | undefined;
  for (const f of NICE_FACTORS) {
    const step = f * power;
    const lo = Math.floor(min / step) * step;
    // 끝값이 경계에 딱 맞아도 마지막 구간이 닫혀 있어 따로 구간을 늘리지 않는다.
    const count = Math.max(1, Math.ceil((max - lo) / step - 1e-9));
    // 똑같이 가까우면 넓은 폭(적은 구간)을 고른다.
    if (!best || Math.abs(count - target) <= Math.abs(best.count - target))
      best = { lo, step, count };
  }
  return best as HistogramBins;
}

/** 구간 경계 (count + 1개) */
export function binEdges(bins: HistogramBins) {
  return Array.from({ length: bins.count + 1 }, (_, i) =>
    roundEdge(bins.lo + bins.step * i, bins.step),
  );
}

/** 0.1 + 0.2 같은 부동소수 찌꺼기를 폭의 자릿수에 맞춰 다듬는다. */
function roundEdge(v: number, step: number) {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  return Number(v.toFixed(Math.min(digits, 15)));
}

/**
 * 값이 든 구간 번호(0부터) SQL 식. width_bucket은 끝값(hi)을 count + 1로 돌려주므로 마지막 구간으로 붙잡는다.
 * 데이터 표·다운로드가 같은 식으로 행을 고르므로 경계 값이 렌더와 어긋나지 않는다.
 */
export function binSql(x: string, bins: HistogramBins) {
  const hi = bins.lo + bins.step * bins.count;
  return `(least(width_bucket(${x}::float8, ${bins.lo}::float8, ${hi}::float8, ${bins.count}), ${bins.count}) - 1)`;
}

export async function queryHistogramData(
  db: PGlite,
  schema: DatasetSchema,
  params: HistogramDataParams,
): Promise<HistogramData> {
  const { table, splitBy, legend } = params;
  const xCol = columnOf(schema, params.x, "numeric");
  const split = splitBy.map((c) => columnOf(schema, c));
  const legendCol = legend
    ? columnOf(schema, legend, "categorical")
    : undefined;
  const x = ident(xCol.name);
  const filter = filterSql(schema, params.filters);
  const where = `${x} is not null${filter.sql}`;

  const range = await db.query<{ min: number | null; max: number | null }>(
    `select min(${x})::float8 as min, max(${x})::float8 as max from ${table} where ${where}`,
    filter.params,
  );
  const { min, max } = range.rows[0] ?? { min: null, max: null };
  const bins = histogramBins(min ?? 0, max ?? 0);
  const legendValues = legendCol
    ? await queryLegendValues(db, table, schema, legendCol.name)
    : undefined;

  const keys = [...split, ...(legendCol ? [legendCol] : [])];
  const keyNames = keys.map((c) => ident(c.name));
  const splitNames = split.map((c) => ident(c.name));
  const sql = `select ${[...split.map(textSql), "_b", ...(legendCol ? [textSql(legendCol)] : [])].join(", ")}, count(*)::int
    from (select *, ${binSql(x, bins)} as _b from ${table} where ${where}) t
    group by ${[...keyNames, "_b"].join(", ")}
    order by ${[...splitNames, "_b", ...(legendCol ? [ident(legendCol.name)] : [])].join(", ")}`;
  const res = await db.query<unknown[]>(sql, filter.params, {
    rowMode: "array",
  });
  return {
    bins,
    legendValues,
    groups: groupBins(res.rows, split.length, bins.count, legendValues),
  };
}

/** 정렬된 행(split…, 구간, [legend], 개수)을 split 조합 단위의 [구간][legend] 개수로 묶는다. */
export function groupBins(
  rows: unknown[][],
  k: number,
  binCount: number,
  legendValues: string[] | undefined,
): HistogramGroup[] {
  const width = legendValues?.length ?? 1;
  const legendIndex = new Map(legendValues?.map((v, i) => [v, i]));
  const groups: HistogramGroup[] = [];
  let current: HistogramGroup | undefined;
  for (const row of rows) {
    const values = row.slice(0, k) as string[];
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = {
        values,
        counts: Array.from({ length: binCount }, () =>
          new Array<number>(width).fill(0),
        ),
      };
      groups.push(current);
    }
    const bin = Number(row[k]);
    const slot = legendValues ? (legendIndex.get(String(row[k + 1])) ?? 0) : 0;
    const count = row[k + 1 + (legendValues ? 1 : 0)] as number;
    if (bin >= 0 && bin < binCount) current.counts[bin][slot] += count;
  }
  return groups;
}
