// sankey 데이터. x 값(출발 노드) → y 값(도착 노드) 흐름을 z 컬럼의 통계 함수로 DB(PGlite)가 SQL로 집계한다.
// 노드가 많으면 흐름이 큰 상위 몇 개만 남기고 나머지를 '기타' 노드 하나로 묶는다.
// 묶기는 원래 행 단위로 하므로 평균·중앙값도 '기타' 안의 행으로 다시 계산한다.

import { sql } from "kysely";
import type { Db } from "../db/database";
import { queryArrays } from "../db/pglite-native";
import { AGG_SQL } from "./category-data";
import {
  allOf,
  columnOf,
  type DatasetSchema,
  ident,
  list,
  tableSql,
  textSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import type { AggFn } from "./schema";

export type SankeyLink = {
  /** sources 인덱스 */
  source: number;
  /** targets 인덱스 */
  target: number;
  value: number;
};

export type SankeyGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  links: SankeyLink[];
};

export type SankeyData = {
  /** 출발 노드 (전체 데이터 기준, 흐름이 큰 순서). 묶었으면 끝이 '기타'다. legend 값이 된다. */
  sources: string[];
  /** 도착 노드 (전체 데이터 기준, 흐름이 큰 순서). 묶었으면 끝이 '기타'다. */
  targets: string[];
  groups: SankeyGroup[];
};

export type SankeyDataParams = {
  table: string;
  x: string;
  y: string;
  z: string;
  agg: AggFn;
  splitBy: string[];
  filters?: ChartFilter[];
};

/** 출발 노드 수 상한 (legend 팔레트 8색). 넘으면 상위 7개 + 기타 */
export const SANKEY_MAX_SOURCES = 8;
/** 도착 노드 수 상한. 넘으면 상위 11개 + 기타 */
export const SANKEY_MAX_TARGETS = 12;
/** 상위에 들지 못한 노드를 묶은 이름 */
export const SANKEY_OTHERS = "기타";

/**
 * 흐름이 큰 순서로 정렬한 노드에서 상한까지 남긴다. 넘으면 상한 - 1개 + 기타.
 * keep은 그대로 쓸 원래 값, nodes는 화면에 놓을 노드 목록이다.
 */
export function topNodes(ranked: readonly string[], max: number) {
  if (ranked.length <= max) return { keep: [...ranked], nodes: [...ranked] };
  const keep = ranked.slice(0, max - 1);
  return { keep, nodes: [...keep, SANKEY_OTHERS] };
}

/**
 * 정렬된 행(split…, 출발, 도착, 값)을 split 조합 단위로 묶는다.
 * 값이 0 이하거나 숫자가 아니면 굵기로 그릴 수 없어 뺀다.
 */
export function groupLinks(
  rows: readonly unknown[][],
  k: number,
  sources: readonly string[],
  targets: readonly string[],
): SankeyGroup[] {
  const sourceIndex = new Map(sources.map((v, i) => [v, i]));
  const targetIndex = new Map(targets.map((v, i) => [v, i]));
  const groups: SankeyGroup[] = [];
  let current: SankeyGroup | undefined;
  for (const row of rows) {
    const values = row.slice(0, k).map(String);
    if (!current || values.some((v, j) => v !== current?.values[j])) {
      current = { values, links: [] };
      groups.push(current);
    }
    const source = sourceIndex.get(String(row[k]));
    const target = targetIndex.get(String(row[k + 1]));
    const value = Number(row[k + 2]);
    if (source === undefined || target === undefined) continue;
    if (!Number.isFinite(value) || value <= 0) continue;
    current.links.push({ source, target, value });
  }
  return groups;
}

export async function querySankeyData(
  db: Db,
  schema: DatasetSchema,
  params: SankeyDataParams,
): Promise<SankeyData> {
  const { table, agg } = params;
  const x = columnOf(schema, params.x, "categorical");
  const y = columnOf(schema, params.y, "categorical");
  const z = ident(columnOf(schema, params.z, "numeric").name);
  const split = params.splitBy.map((c) => columnOf(schema, c));
  const from = tableSql(table);
  const where = allOf([
    sql`${ident(x.name)} is not null`,
    sql`${ident(y.name)} is not null`,
    sql`${z} is not null`,
    ...filterSql(schema, params.filters),
  ]);
  const value = sql`${AGG_SQL[agg](z)}::float8`;

  // ── 노드 순위: 전체 데이터에서 흐름이 큰 순서. 상한 + 1개만 보면 묶을지 알 수 있다 ──
  const rank = async (column: typeof x, max: number) => {
    const res = await sql<{
      v: string;
    }>`select ${textSql(column)} as v from ${from} where ${where}
        group by ${ident(column.name)} order by ${value} desc nulls last, ${ident(column.name)}
        limit ${sql.lit(max + 1)}`.execute(db);
    return topNodes(
      res.rows.map((r) => r.v),
      max,
    );
  };
  const sources = await rank(x, SANKEY_MAX_SOURCES);
  const targets = await rank(y, SANKEY_MAX_TARGETS);

  // ── 흐름: 상위에 들지 못한 값은 원래 행 단위로 '기타'에 넣고 집계한다 ──
  const bucket = (column: typeof x, keep: string[]) =>
    sql`case when ${textSql(column)} in (select jsonb_array_elements_text(${JSON.stringify(keep)}::jsonb)) then ${textSql(column)} else ${SANKEY_OTHERS} end`;
  const k = split.length;
  const splitOrder = split.map((c) => ident(c.name));
  // split은 원래 타입 순서로 정렬하고 text로 돌려받는다. 출발·도착은 select 순번으로 묶는다.
  const groupBy = list([...splitOrder, sql.lit(k + 1), sql.lit(k + 2)]);
  const rows = await queryArrays(
    db,
    sql`select ${list([...split.map(textSql), bucket(x, sources.keep), bucket(y, targets.keep)])}, ${value}
    from ${from} where ${where}
    group by ${groupBy} order by ${groupBy}`,
  );
  return {
    sources: sources.nodes,
    targets: targets.nodes,
    groups: groupLinks(rows, k, sources.nodes, targets.nodes),
  };
}
