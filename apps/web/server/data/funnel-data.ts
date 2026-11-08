// funnel 데이터. 범주(단계)별 집계는 bar와 같고, split 조합마다 값 큰 순으로 줄 세운다.
// 단계가 많으면 위에서부터 FUNNEL_MAX_STAGES - 1개만 두고 나머지 행은 '기타' 하나로 다시 집계한다.
// 평균·중앙값처럼 더할 수 없는 통계도 맞도록 '기타'는 값을 더하지 않고 원래 행에서 다시 센다.

import { sql } from "kysely";
import type { Db } from "../db/database";
import {
  AGG_SQL,
  type CategoryData,
  type CategoryDataParams,
  queryBarData,
} from "./category-data";
import {
  allOf,
  columnOf,
  type DatasetSchema,
  ident,
  tableSql,
  textSql,
} from "./dataset-schema";
import { filterSql } from "./filters";

/** 한 item에 그리는 단계 수 상한 ('기타' 포함). legend 팔레트 8색에 맞춘다. */
export const FUNNEL_MAX_STAGES = 8;
export const FUNNEL_OTHERS = "기타";

/** split 조합 키. SQL 쪽(splitKeySql)과 같은 규칙으로 null은 빈 글자로 본다. */
const keyOf = (values: readonly (string | null)[]) =>
  values.map((v) => v ?? "").join("\u001f");

/**
 * 단계를 값 큰 순으로 줄 세우고, 넘치면 앞의 max - 1개만 남긴다 (같은 값이면 이름 순).
 * rest는 '기타'로 묶을 범주다.
 */
export function rankStages(
  categories: readonly string[],
  values: readonly (number | null)[],
  max = FUNNEL_MAX_STAGES,
) {
  const order = categories
    .map((c, i) => ({ c, v: values[i] ?? 0 }))
    .sort((a, b) => b.v - a.v || (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
  if (order.length <= max) return { top: order, rest: [] as string[] };
  return {
    top: order.slice(0, max - 1),
    rest: order.slice(max - 1).map((o) => o.c),
  };
}

export async function queryFunnelData(
  db: Db,
  schema: DatasetSchema,
  params: Omit<CategoryDataParams, "chartType" | "legend">,
): Promise<CategoryData> {
  const base = await queryBarData(db, schema, {
    ...params,
    chartType: "bar",
    legend: null,
  });
  const ranked = base.groups.map((g) => ({
    group: g,
    ...rankStages(
      g.categories,
      (g.bars ?? []).map((row) => row[0]),
    ),
  }));
  const overflow = ranked.filter((r) => r.rest.length > 0);
  const others = overflow.length
    ? await queryOthers(db, schema, params, overflow)
    : new Map<string, number | null>();
  return {
    groups: ranked.map(({ group, top, rest }) => {
      const categories = top.map((t) => t.c);
      const bars: (number | null)[][] = top.map((t) => [t.v]);
      if (rest.length) {
        categories.push(FUNNEL_OTHERS);
        bars.push([others.get(keyOf(group.values)) ?? null]);
      }
      return { values: group.values, categories, bars };
    }),
  };
}

/** 넘친 split 조합마다 '기타'로 묶을 범주의 행만 모아 다시 집계한다. */
async function queryOthers(
  db: Db,
  schema: DatasetSchema,
  params: Omit<CategoryDataParams, "chartType" | "legend">,
  overflow: { group: { values: string[] }; rest: string[] }[],
) {
  const x = columnOf(schema, params.x, "categorical");
  const y = ident(columnOf(schema, params.y, "numeric").name);
  const split = params.splitBy.map((c) => columnOf(schema, c));
  const splitKey = split.length
    ? sql.join(
        split.map((c) => sql`coalesce(${textSql(c)}, '')`),
        sql` || chr(31) || `,
      )
    : sql`''`;
  const keys = overflow.flatMap((o) =>
    o.rest.map((c) => `${keyOf(o.group.values)}\u001e${c}`),
  );
  const where = allOf([
    sql`${y} is not null`,
    ...filterSql(schema, params.filters),
    sql`(${splitKey} || chr(30) || coalesce(${textSql(x)}, '')) in
        (select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))`,
  ]);
  const res = await sql<{
    k: string;
    v: number | null;
  }>`select ${splitKey} as k, ${AGG_SQL[params.agg](y)}::float8 as v
    from ${tableSql(params.table)}
    where ${where}
    group by 1`.execute(db);
  return new Map(res.rows.map((r) => [r.k, r.v]));
}
