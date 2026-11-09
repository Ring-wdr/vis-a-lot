// Kysely로 옮길 수 없는 PGlite 드라이버 기능만 모은 곳. 다른 DB로 갈 때 이 파일을 바꾼다.
// - COPY: PGlite는 '/dev/blob'으로 Blob을 주고받는다 (node-postgres면 pg-copy-streams 등으로 바꾼다).
// - rowMode array: Kysely 결과는 행마다 객체라, 수십만 행을 받는 차트 쿼리는 배열 행으로 직접 받는다
//   (node-postgres는 같은 rowMode: 'array'가 있다. 없는 드라이버면 c0, c1 … 별칭으로 받아 배열로 바꾼다).
// SQL 자체는 모두 Kysely가 만든다. 여기서는 컴파일 결과를 원본 PGlite로 실행만 한다.

import type { PGlite } from "@electric-sql/pglite";
import { createQueryId, type Kysely, PostgresQueryCompiler, sql } from "kysely";
import type { Database, Sql } from "./database";

const natives = new WeakMap<Kysely<Database>, PGlite>();

/** createDb가 만든 인스턴스와 원본 PGlite를 잇는다. */
export function bindNative(db: Kysely<Database>, pglite: PGlite) {
  natives.set(db, pglite);
}

function nativeOf(db: Kysely<Database>) {
  const pglite = natives.get(db);
  if (!pglite) throw new Error("createDb로 만든 DB 인스턴스가 아닙니다.");
  return pglite;
}

/** 결과를 배열 행(select 순서)으로 받는다. */
export async function queryArrays<T extends unknown[] = unknown[]>(
  db: Kysely<Database>,
  query: Sql,
): Promise<T[]> {
  const compiled = query.compile(db);
  const res = await nativeOf(db).query<T>(
    compiled.sql,
    [...compiled.parameters],
    { rowMode: "array" },
  );
  return res.rows;
}

/** CSV(머리글 없음)를 테이블에 적재한다. */
export async function copyFrom(db: Kysely<Database>, table: string, csv: Blob) {
  const compiled =
    sql`copy ${sql.table(table)} from '/dev/blob' with (format csv)`.compile(
      db,
    );
  await nativeOf(db).query(compiled.sql, [...compiled.parameters], {
    blob: csv,
  });
}

/** 쿼리 결과를 CSV(머리글 = 결과 컬럼 이름)로 받는다. */
export async function copyTo(db: Kysely<Database>, query: Sql): Promise<Blob> {
  // COPY는 바인딩 파라미터를 받지 않으므로 값을 SQL 글자로 넣어 컴파일한다.
  const compiled = new InlineValuesCompiler().compileQuery(
    sql`copy (${query}) to '/dev/blob' with (format csv, header)`.toOperationNode(),
    createQueryId(),
  );
  const res = await nativeOf(db).query(compiled.sql);
  if (!res.blob) throw new Error("CSV export returned no data");
  return res.blob;
}

/**
 * 바인딩 값을 파라미터 대신 SQL 글자로 넣는 컴파일러. Kysely의 sql.lit과 같은 규칙이다
 * (글자는 작은따옴표를 겹쳐 쓰고, 숫자는 그대로).
 */
class InlineValuesCompiler extends PostgresQueryCompiler {
  protected override appendValue(value: unknown) {
    this.appendImmediateValue(value);
  }
}
