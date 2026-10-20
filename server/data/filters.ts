// 차트 필터 → SQL 조건. 값은 모두 바인딩 파라미터로 넘기고, 컬럼 이름은 데이터셋 정의로 확인한다.

import { COLUMNS, type ColumnName } from "./schema";

/**
 * 숫자·시계열 컬럼: [min, max] 안(inverse면 밖)만 남긴다. 시계열 값은 epoch ms다.
 * includeNull이 false면 값이 없는 행을 뺀다.
 */
export type RangeFilter = {
  kind: "range";
  column: ColumnName;
  min: number;
  max: number;
  inverse: boolean;
  includeNull: boolean;
};

/** 범주 컬럼: 고른 값을 뺀다 (기본은 전부 포함). */
export type ExcludeFilter = {
  kind: "exclude";
  column: ColumnName;
  values: string[];
};

export type ChartFilter = RangeFilter | ExcludeFilter;

const COLUMN_TYPE = new Map<string, string>(
  COLUMNS.map((c) => [c.name, c.type]),
);

/** 숫자로 비교할 식. 시계열은 epoch ms로 바꾼다. */
function numeric(column: ColumnName) {
  return COLUMN_TYPE.get(column) === "time"
    ? `(extract(epoch from ${column}) * 1000)`
    : column;
}

/**
 * where 절 뒤에 붙일 조건(`and (...)`)과 파라미터. 파라미터 번호는 firstParam부터 쓴다.
 * 컬럼 타입과 필터 종류가 맞지 않으면 던진다.
 */
export function filterSql(
  filters: readonly ChartFilter[] | undefined,
  firstParam = 1,
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${firstParam + params.length - 1}`;
  };
  for (const f of filters ?? []) {
    const type = COLUMN_TYPE.get(f.column);
    if (!type) throw new Error(`unknown column ${f.column}`);
    if (f.kind === "range") {
      if (type === "string") throw new Error(`${f.column} is not numeric`);
      const v = numeric(f.column);
      const lo = param(f.min);
      const hi = param(f.max);
      const inside = f.inverse
        ? `(${v} < ${lo}::float8 or ${v} > ${hi}::float8)`
        : `(${v} >= ${lo}::float8 and ${v} <= ${hi}::float8)`;
      // null은 비교식에서 빠지므로, 포함할 때만 따로 붙인다.
      parts.push(f.includeNull ? `(${inside} or ${f.column} is null)` : inside);
    } else {
      if (type !== "string") throw new Error(`${f.column} is not categorical`);
      if (f.values.length === 0) continue;
      parts.push(
        `not (${f.column}::text in (select jsonb_array_elements_text(${param(JSON.stringify(f.values))}::jsonb)))`,
      );
    }
  }
  return {
    sql: parts.map((p) => ` and ${p}`).join(""),
    params,
  };
}
