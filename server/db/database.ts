// DB Worker의 Kysely 인스턴스와 고정 테이블 타입.
// 다른 DB로 바꿀 때는 createDb의 dialect(지금은 Kysely 내장 PGliteDialect)만 바꾸면 된다.
// 단, PGlite 드라이버 기능(COPY, rowMode array)은 Kysely를 거치지 않으므로 ./pglite-native.ts도 함께 바꾼다.

import type { PGlite } from "@electric-sql/pglite";
import {
  type ColumnType,
  type Generated,
  Kysely,
  PGliteDialect,
  type RawBuilder,
} from "kysely";
import type { HistoryDetail, HistorySummary } from "../api/types";
import type { ColumnStat, StoredUpload } from "../data/datasets";
import { bindNative } from "./pglite-native";

/** jsonb 컬럼: 읽으면 값, 쓸 때는 JSON 글자 */
type Json<T> = ColumnType<T, string, string>;
type NullableJson<T> = ColumnType<T | null, string | null, string | null>;

export interface BootLogTable {
  id: Generated<number>;
  booted_at: Generated<Date>;
}

export interface DatasetMetaTable {
  id: string;
  kind: "sample" | "upload";
  name: string;
  tbl: string;
  status: "generating" | "ready" | "failed";
  generator_version: number | null;
  columns: NullableJson<ColumnStat[]>;
  row_count: number | null;
  generate_ms: number | null;
  upload: NullableJson<StoredUpload>;
  error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface HistoryTable {
  id: string;
  created_at: number;
  updated_at: number;
  dataset: string;
  generator_version: number;
  spec: Json<HistorySummary["spec"]>;
  status: HistorySummary["status"];
  items: Json<HistoryDetail["items"]>;
  events: Json<HistoryDetail["events"]>;
  thumbnail: string | null;
}

/** 행 수로 데이터셋을 구분하던 예전 메타. 남아 있으면 dataset_meta로 옮기고 지운다. */
export interface LegacyDatasetsTable {
  rows: number;
  generator_version: number;
  status: string;
  columns: NullableJson<ColumnStat[]>;
  generate_ms: number | null;
}

/** 이름이 정해진 테이블. 데이터셋 테이블(readings_*, upload_*)은 컬럼을 스키마에서 읽으므로 여기 없다. */
export interface Database {
  boot_log: BootLogTable;
  dataset_meta: DatasetMetaTable;
  history: HistoryTable;
  datasets: LegacyDatasetsTable;
}

export type Db = Kysely<Database>;

/** sql 태그로 만든 조각. 데이터셋 테이블 쿼리는 이 조각을 이어 붙여 만든다. */
export type Sql = RawBuilder<unknown>;

/** PGlite를 감싼 Kysely 인스턴스. DB를 바꿀 때는 여기 dialect를 바꾼다. */
export function createDb(pglite: PGlite): Db {
  const db = new Kysely<Database>({
    dialect: new PGliteDialect({ pglite }),
  });
  bindNative(db, pglite);
  return db;
}
