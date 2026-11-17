// 관리선(controlLimit)의 컬럼 선·띠 값. split 조합별로 요청한 (컬럼, 함수)를 한 번의 group by로 집계한다.
// 집계 범위는 split 조합 + 필터를 건 행이다. 끈 legend 값·지운 점은 빼지 않는다 (규격선이 체크박스로 움직이지 않게).
// 구간별(multi)은 필터를 건 전체 데이터의 x 범위를 LIMIT_BUCKETS개로 나눠 모든 item이 같은 구간을 쓴다.
// 그래야 item마다 x 범위가 달라도 계단 경계가 같고, 확대해도 다시 조회하지 않는다.

import { sql } from "kysely";
import type { Db, Sql } from "../db/database";
import { queryArrays } from "../db/pglite-native";
import type { LimitStep, ResolvedLimit } from "../render/control-limit";
import { LIMIT_BUCKETS, type LimitFn, type LimitLine } from "../render/options";
import { AGG_SQL } from "./category-data";
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

/** 집계 하나. 띠는 두 컬럼의 avg 요청 둘이다. */
export type LimitRequest = { column: string; fn: LimitFn; multi: boolean };

/** 캐시·중복 제거용 키 */
export const limitRequestKey = (r: LimitRequest) =>
  JSON.stringify([r.column, r.fn, r.multi]);

/** 구간별 구간: [lo, hi]를 count개로 똑같이 나눈다. 마지막 구간만 hi를 포함한다. lo === hi면 구간 하나다. */
export type LimitBuckets = { lo: number; hi: number; count: number };

/** 구간별 요청의 값: 값이 있는 구간만 [구간 번호(0부터), 값], 구간 순 */
export type LimitBucketValues = [bucket: number, value: number][];

/** 요청 하나의 값. 구간별이 아니면 값(못 구하면 null), 구간별이면 구간별 값 */
export type LimitResult = number | null | LimitBucketValues;

export type LimitGroup = {
  /** split 컬럼 순서대로의 값 (차트 데이터의 split 값과 같은 text) */
  values: string[];
  /** 요청 순서대로의 값 */
  results: LimitResult[];
};

export type LimitData = {
  /** 구간별 요청이 있을 때 쓴 구간. x 값이 하나도 없으면 null, 구간별 요청이 없으면 undefined */
  buckets?: LimitBuckets | null;
  /** 행이 있는 split 조합만 */
  groups: LimitGroup[];
};

export type LimitDataParams = {
  table: string;
  /** 구간을 나눌 x 컬럼 (숫자·시계열). 구간별 요청이 있을 때만 쓴다. */
  x: string;
  splitBy: string[];
  filters?: ChartFilter[];
  requests: LimitRequest[];
  /** 앞서 정한 구간. 주면 범위를 다시 조회하지 않고 이 구간으로 나눈다 (같은 차트의 다른 요청과 경계를 맞춘다). */
  buckets?: LimitBuckets | null;
};

/** 구간 i의 x 경계 [x0, x1]. 마지막 구간의 끝은 hi 그대로다. */
export function bucketEdges(b: LimitBuckets, i: number): [number, number] {
  const step = (b.hi - b.lo) / b.count;
  return [b.lo + step * i, i === b.count - 1 ? b.hi : b.lo + step * (i + 1)];
}

/**
 * x가 든 구간 번호 SQL 식(0부터). width_bucket은 hi를 count + 1로 돌려주므로 마지막 구간으로 붙잡는다.
 * 값은 글자로 넣어 select와 group by의 식이 같게 한다 (별칭을 쓰면 데이터 컬럼 이름과 겹칠 수 있다).
 */
function bucketSql(x: Sql, b: LimitBuckets): Sql {
  // 상수 0은 group by에서 위치 번호로 읽히므로 형 변환한 식으로 둔다.
  if (b.lo === b.hi || b.count <= 1) return sql`0::int`;
  const count = sql.lit(b.count);
  return sql`(least(width_bucket(${x}::float8, (${sql.lit(b.lo)})::float8, (${sql.lit(b.hi)})::float8, ${count}), ${count}) - 1)`;
}

export async function queryLimitData(
  db: Db,
  schema: DatasetSchema,
  params: LimitDataParams,
): Promise<LimitData> {
  const { table, requests } = params;
  const split = params.splitBy.map((c) => columnOf(schema, c));
  const from = tableSql(table);
  const filters = filterSql(schema, params.filters);
  const aggOf = (r: LimitRequest) =>
    sql`${AGG_SQL[r.fn](sql`${ident(columnOf(schema, r.column, "numeric").name)}::float8`)}::float8`;
  const keyNames = split.map((c) => ident(c.name));
  const k = split.length;

  const single = requests.flatMap((r, i) => (r.multi ? [] : [i]));
  const multi = requests.flatMap((r, i) => (r.multi ? [i] : []));
  const groups = new Map<string, LimitGroup>();
  const groupOf = (values: string[]) => {
    const key = JSON.stringify(values);
    let g = groups.get(key);
    if (!g) {
      g = {
        values,
        results: requests.map((r) => (r.multi ? [] : null)),
      };
      groups.set(key, g);
    }
    return g;
  };

  if (single.length > 0) {
    const rows = await queryArrays(
      db,
      sql`select ${list([...split.map(textSql), sql`count(*)::int`, ...single.map((i) => aggOf(requests[i]))])}
      from ${from} where ${allOf(filters)}
      ${k > 0 ? sql`group by ${list(keyNames)} order by ${list(keyNames)}` : sql``}`,
    );
    for (const row of rows) {
      // split이 없고 맞는 행이 없으면 집계가 개수 0인 한 행이다.
      if ((row[k] as number) === 0) continue;
      const g = groupOf(row.slice(0, k) as string[]);
      single.forEach((ri, j) => {
        g.results[ri] = numberOrNull(row[k + 1 + j]);
      });
    }
  }

  let buckets: LimitBuckets | null | undefined;
  if (multi.length > 0) {
    const xCol = columnOf(schema, params.x, "numeric", "datetime");
    const x = numericSql(xCol);
    const where = allOf([sql`${ident(xCol.name)} is not null`, ...filters]);
    buckets =
      params.buckets !== undefined
        ? params.buckets
        : await queryBuckets(db, x, from, where);
    if (buckets) {
      const b = bucketSql(x, buckets);
      const rows = await queryArrays(
        db,
        sql`select ${list([...split.map(textSql), b, ...multi.map((i) => aggOf(requests[i]))])}
        from ${from} where ${where}
        group by ${list([...keyNames, b])} order by ${list([...keyNames, b])}`,
      );
      for (const row of rows) {
        const g = groupOf(row.slice(0, k) as string[]);
        const bucket = Number(row[k]);
        multi.forEach((ri, j) => {
          const v = numberOrNull(row[k + 1 + j]);
          if (v !== null)
            (g.results[ri] as LimitBucketValues).push([bucket, v]);
        });
      }
    }
  }
  return { buckets, groups: [...groups.values()] };
}

/** 필터를 건 전체 데이터의 x 범위 → 구간. 값이 없으면 null */
async function queryBuckets(
  db: Db,
  x: Sql,
  from: Sql,
  where: Sql,
): Promise<LimitBuckets | null> {
  const res = await sql<{
    min: number | null;
    max: number | null;
  }>`select min(${x})::float8 as min, max(${x})::float8 as max from ${from} where ${where}`.execute(
    db,
  );
  const { min, max } = res.rows[0] ?? { min: null, max: null };
  if (min === null || max === null) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { lo: min, hi: max, count: min === max ? 1 : LIMIT_BUCKETS };
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 선이 쓰는 집계 요청. 기준선은 조회하지 않는다. */
export function limitRequestsOf(line: LimitLine): LimitRequest[] {
  if (line.kind === "column")
    return [{ column: line.column, fn: line.fn, multi: line.multi }];
  if (line.kind === "band")
    return [
      { column: line.column, fn: "avg", multi: line.multi },
      { column: line.column2, fn: "avg", multi: line.multi },
    ];
  return [];
}

/**
 * 선 목록 → 렌더 입력. resultOf는 그 item의 요청 값(조회하지 않았거나 행이 없으면 undefined)이다.
 * 값을 못 구한 선은 뺀다. timeX면 bottom 기준선의 ISO 시각을 epoch ms로 바꾼다.
 */
export function resolveLimits(
  lines: readonly LimitLine[],
  resultOf: (r: LimitRequest) => LimitResult | undefined,
  buckets: LimitBuckets | null | undefined,
  timeX: boolean,
): ResolvedLimit[] {
  const out: ResolvedLimit[] = [];
  const stepsOf = (values: LimitBucketValues[]): LimitStep[] => {
    if (!buckets) return [];
    if (values.length === 1)
      return values[0].map(([b, v]) => [...bucketEdges(buckets, b), v]);
    // 띠: 두 값이 다 있는 구간만
    const second = new Map(values[1]);
    return values[0].flatMap(([b, v]): LimitStep[] => {
      const v2 = second.get(b);
      return v2 === undefined ? [] : [[...bucketEdges(buckets, b), v, v2]];
    });
  };
  for (const line of lines) {
    const base = {
      name: line.name,
      kind: line.kind,
      axis: line.axis,
      type: line.kind === "band" ? "none" : line.type,
      color: line.color,
      width: line.width,
      style: line.style,
    } as const;
    if (line.kind === "reference") {
      const value =
        typeof line.value === "string"
          ? line.axis === "bottom" && timeX
            ? Date.parse(line.value)
            : Number(line.value)
          : line.value;
      if (Number.isFinite(value)) out.push({ ...base, multi: false, value });
      continue;
    }
    const results = limitRequestsOf(line).map(resultOf);
    if (line.multi) {
      if (!results.every(Array.isArray)) continue;
      const steps = stepsOf(results as LimitBucketValues[]);
      if (steps.length > 0) out.push({ ...base, multi: true, steps });
      continue;
    }
    if (!results.every((v): v is number => typeof v === "number")) continue;
    const [value, value2] = results as number[];
    out.push(
      line.kind === "band"
        ? { ...base, multi: false, value, value2 }
        : { ...base, multi: false, value },
    );
  }
  return out;
}
