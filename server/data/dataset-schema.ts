// 데이터셋 스키마: 적재된 테이블에서 컬럼과 타입을 읽는다.
// 공장마다 raw data의 컬럼 이름이 제각각이므로, 이름을 미리 정해 두지 않고 DB 타입으로 논리 타입을 정한다.

import type { PGlite } from "@electric-sql/pglite";

/** 화면과 API가 쓰는 논리 타입 */
export const LOGICAL_TYPES = ["categorical", "numeric", "datetime"] as const;
export type LogicalType = (typeof LOGICAL_TYPES)[number];

export type ColumnSchema = {
  name: string;
  type: LogicalType;
  /** 컬럼 주석(comment)이 있으면 그 값, 없으면 컬럼 이름 */
  label: string;
  nullable: boolean;
};

export type DatasetSchema = {
  columns: ColumnSchema[];
  byName: Map<string, ColumnSchema>;
};

const NUMERIC_TYPES = new Set([
  "smallint",
  "integer",
  "bigint",
  "numeric",
  "real",
  "double precision",
]);
const DATETIME_TYPES = new Set([
  "timestamp with time zone",
  "timestamp without time zone",
  "date",
]);

/** Postgres 타입 → 논리 타입. 숫자·시각이 아니면 모두 범주로 본다 (text, boolean, uuid …). */
export function logicalTypeOf(dataType: string): LogicalType {
  if (NUMERIC_TYPES.has(dataType)) return "numeric";
  if (DATETIME_TYPES.has(dataType)) return "datetime";
  return "categorical";
}

export function schemaOf(columns: ColumnSchema[]): DatasetSchema {
  return { columns, byName: new Map(columns.map((c) => [c.name, c])) };
}

/** information_schema에서 컬럼 순서대로 읽는다. 라벨은 컬럼 주석을 쓴다. */
export async function readTableSchema(
  db: PGlite,
  table: string,
): Promise<DatasetSchema | null> {
  const res = await db.query<{
    name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    comment: string | null;
  }>(
    `select c.column_name as name, c.data_type, c.is_nullable,
       col_description(format('%I.%I', c.table_schema, c.table_name)::regclass, c.ordinal_position) as comment
     from information_schema.columns c
     where c.table_schema = current_schema() and c.table_name = $1
     order by c.ordinal_position`,
    [table],
  );
  if (res.rows.length === 0) return null;
  return schemaOf(
    res.rows.map((r) => ({
      name: r.name,
      type: logicalTypeOf(r.data_type),
      label: r.comment || r.name,
      nullable: r.is_nullable === "YES",
    })),
  );
}

/** 사용자에게 그대로 보여줄 수 있는 스키마 오류 (없는 컬럼, 타입이 맞지 않는 컬럼) */
export class SchemaError extends Error {}

/** 식별자 인용. 공백·대문자·한글·따옴표가 든 컬럼 이름도 SQL에 안전하게 넣는다. */
export function ident(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** 스키마에 있는 컬럼인지, 허용한 타입인지 확인한다. */
export function columnOf(
  schema: DatasetSchema,
  name: string,
  ...allowed: LogicalType[]
): ColumnSchema {
  const column = schema.byName.get(name);
  if (!column) throw new SchemaError(`컬럼 '${name}'이 데이터에 없습니다.`);
  if (allowed.length > 0 && !allowed.includes(column.type)) {
    throw new SchemaError(
      `'${column.label}'은 ${column.type} 컬럼이라 여기에 쓸 수 없습니다 (${allowed.join(" / ")}만 가능).`,
    );
  }
  return column;
}

/** 숫자로 비교·축에 쓸 식. 시각은 epoch ms 숫자로 바꾼다. */
export function numericSql(column: ColumnSchema) {
  if (column.type === "datetime")
    return `(extract(epoch from ${ident(column.name)}) * 1000)`;
  if (column.type === "numeric") return ident(column.name);
  throw new SchemaError(`'${column.label}'은 숫자로 쓸 수 없습니다.`);
}

/** 범주 값으로 쓸 식 (text) */
export function textSql(column: ColumnSchema) {
  return `${ident(column.name)}::text`;
}
