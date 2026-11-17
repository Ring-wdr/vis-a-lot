// 차트 필터 → SQL 조건. 값은 모두 바인딩 파라미터로 넘기고, 컬럼은 데이터셋 스키마로 확인해 인용한다.

import { sql } from "kysely";
import type { Sql } from "../db/database";
import {
  columnOf,
  type DatasetSchema,
  ident,
  numericSql,
  tableSql,
  textSql,
} from "./dataset-schema";
import { type ItemRowsScope, itemRowsWhere } from "./item-rows";

/**
 * 숫자·시계열 컬럼: [min, max] 안(inverse면 밖)만 남긴다. 시계열 값은 epoch ms다.
 * includeNull이 false면 값이 없는 행을 뺀다.
 */
export type RangeFilter = {
  kind: "range";
  column: string;
  min: number;
  max: number;
  inverse: boolean;
  includeNull: boolean;
};

/** 범주 컬럼: 고른 값을 뺀다 (기본은 전부 포함). */
export type ExcludeFilter = {
  kind: "exclude";
  column: string;
  values: string[];
};

/** 화면이 고르는 draw 필터 (spec.filters, API 스키마) */
export type SpecFilter = RangeFilter | ExcludeFilter;

/**
 * 서버 내부용 '행 범위': 다른 차트 item이 그린 행 (칸 연결). API 스키마에는 없다.
 * 같은 데이터셋이면 scope 조건을 그대로 걸고, 다른 데이터셋이면 연결 컬럼 값(글자)으로 잇는다.
 */
export type RowsFilter = {
  kind: "rows";
  /** 따를 칸 item의 행 범위 (itemRowsScope) */
  scope: ItemRowsScope;
  /** 다른 데이터셋: 따를 칸의 데이터셋과 연결 컬럼 (source = 따를 칸 쪽, target = 이 차트 쪽) */
  join?: { dataset: string; source: string; target: string };
  /** join의 source 테이블과 스키마. DB Worker가 join.dataset으로 채운다 (resolveRowsSources). */
  from?: { table: string; schema: DatasetSchema };
};

/** 조회가 받는 필터: draw 필터 + 행 범위 */
export type ChartFilter = SpecFilter | RowsFilter;

/** 행 범위 조건. 다른 데이터셋은 `이 차트 컬럼 in (선택된 행의 따를 칸 컬럼 값)`, 글자로 비교한다. */
function rowsSql(schema: DatasetSchema, f: RowsFilter): Sql {
  if (!f.join) return sql`(${itemRowsWhere(schema, f.scope)})`;
  if (!f.from) throw new Error("rows filter source is not resolved");
  const target = columnOf(schema, f.join.target);
  const source = columnOf(f.from.schema, f.join.source);
  return sql`${textSql(target)} in (select distinct ${textSql(source)} from ${tableSql(f.from.table)} where ${itemRowsWhere(f.from.schema, f.scope)})`;
}

/**
 * 다른 데이터셋 행 범위의 source 테이블·스키마를 채운다. 데이터셋 id만 오가는 RPC 뒤(DB Worker)에서 부른다.
 * 행 범위가 없으면 같은 배열을 돌려준다.
 */
export async function resolveRowsSources<F extends ChartFilter>(
  filters: readonly F[] | undefined,
  lookup: (
    dataset: string,
  ) => Promise<{ table: string; schema: DatasetSchema }>,
): Promise<F[] | undefined> {
  if (!filters?.some((f) => f.kind === "rows" && f.join && !f.from))
    return filters as F[] | undefined;
  return Promise.all(
    filters.map(async (f) =>
      f.kind === "rows" && f.join && !f.from
        ? { ...f, from: await lookup(f.join.dataset) }
        : f,
    ),
  );
}

/**
 * 필터마다의 where 조건 조각. 값은 바인딩으로 넣으므로 다른 조건과 자유롭게 이어 붙인다 (allOf).
 * 스키마에 없는 컬럼이거나 컬럼 타입과 필터 종류가 맞지 않으면 SchemaError를 던진다.
 */
export function filterSql(
  schema: DatasetSchema,
  filters: readonly ChartFilter[] | undefined,
): Sql[] {
  const parts: Sql[] = [];
  for (const f of filters ?? []) {
    if (f.kind === "rows") {
      parts.push(rowsSql(schema, f));
    } else if (f.kind === "range") {
      const column = columnOf(schema, f.column, "numeric", "datetime");
      const v = numericSql(column);
      const inside = f.inverse
        ? sql`(${v} < ${f.min}::float8 or ${v} > ${f.max}::float8)`
        : sql`(${v} >= ${f.min}::float8 and ${v} <= ${f.max}::float8)`;
      // null은 비교식에서 빠지므로, 포함할 때만 따로 붙인다.
      parts.push(
        f.includeNull
          ? sql`(${inside} or ${ident(column.name)} is null)`
          : inside,
      );
    } else {
      const column = columnOf(schema, f.column, "categorical");
      if (f.values.length === 0) continue;
      parts.push(
        sql`not (${textSql(column)} in (select jsonb_array_elements_text(${JSON.stringify(f.values)}::jsonb)))`,
      );
    }
  }
  return parts;
}
