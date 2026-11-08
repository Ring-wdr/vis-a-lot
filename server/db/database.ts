// DB Worker의 Kysely 인스턴스와 고정 테이블 타입.
// 다른 DB로 바꿀 때는 createDb의 dialect(지금은 Kysely 내장 PGliteDialect)만 바꾸면 된다.
// 단, PGlite 드라이버 기능(COPY, rowMode array)은 Kysely를 거치지 않으므로 ./pglite-native.ts도 함께 바꾼다.

import type { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import {
  type ColumnType,
  type Generated,
  Kysely,
  PGliteDialect,
  type RawBuilder,
} from "kysely";
import type { HistoryDetail, HistorySummary, Share } from "../api/types";
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

export interface SharesTable {
  id: string;
  created_at: number;
  created_by: string;
  created_by_name: string;
  title: string;
  dataset: string;
  spec: Json<Share["spec"]>;
  restore: Json<Share["restore"]>;
  item: Json<Share["item"]>;
  width: number;
  height: number;
  png: Uint8Array;
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
  shares: SharesTable;
  datasets: LegacyDatasetsTable;
}

export type Db = Kysely<Database>;

/** sql 태그로 만든 조각. 데이터셋 테이블 쿼리는 이 조각을 이어 붙여 만든다. */
export type Sql = RawBuilder<unknown>;

/** PGlite를 만들 때 넣는 확장. 피드 검색 인덱스(trigram)가 pg_trgm을 쓴다. */
export const PGLITE_EXTENSIONS = { pg_trgm };

/**
 * 플래너 설정. PGlite의 페이지는 모두 메모리(wasm 힙)에 있는데 기본값은 디스크를 가정한다.
 * - random_page_cost: 인덱스로 띄엄띄엄 읽는 비용을 순차 읽기와 비슷하게 본다 (기본 4는 HDD 기준).
 *   기본값이면 게시물 몇천 건의 이력을 인덱스로 찾는 대신 이력 전체를 해시 조인한다.
 * - work_mem: 정렬·해시가 쓰는 메모리. 기본 4MB면 100만 행 median·상자 그림이 임시 파일로 넘친다.
 * PGlite는 연결이 하나라 부팅할 때 한 번 SET하면 끝까지 유지된다.
 */
export const PLANNER_SETTINGS = /* sql */ `
set random_page_cost = 1.1;
set work_mem = '64MB';
`;

/** PGlite를 감싼 Kysely 인스턴스. DB를 바꿀 때는 여기 dialect를 바꾼다. */
export function createDb(pglite: PGlite): Db {
  const db = new Kysely<Database>({
    dialect: new PGliteDialect({ pglite }),
  });
  bindNative(db, pglite);
  return db;
}
