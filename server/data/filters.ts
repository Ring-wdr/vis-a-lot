// 차트 필터 → SQL 조건. 값은 모두 바인딩 파라미터로 넘기고, 컬럼은 데이터셋 스키마로 확인해 인용한다.

import { sql } from "kysely";
import type { Sql } from "../db/database";
import {
  columnOf,
  type DatasetSchema,
  ident,
  numericSql,
  textSql,
} from "./dataset-schema";

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

export type ChartFilter = RangeFilter | ExcludeFilter;

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
    if (f.kind === "range") {
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
