// 피드 스키마 만들기와 버전 관리. DB Worker가 부팅할 때 부른다.

import type { PGlite } from "@electric-sql/pglite";
import { FEED_DDL, FEED_SCHEMA_VERSION } from "./ddl";

async function currentVersion(pglite: PGlite) {
  const exists = await pglite.query<{ exists: boolean }>(
    `select exists (select 1 from information_schema.tables
       where table_schema = 'feed' and table_name = 'meta') as exists`,
  );
  if (!exists.rows[0]?.exists) return 0;
  const row = await pglite.query<{ value: string }>(
    `select value from feed.meta where key = 'schema_version'`,
  );
  return Number(row.rows[0]?.value ?? 0);
}

/** 버전이 다르면 피드 스키마를 지우고 새로 만든다. 프로토타입이라 데이터 이전은 하지 않는다(시드로 다시 채운다). */
export async function migrateFeed(pglite: PGlite) {
  const version = await currentVersion(pglite);
  if (version === FEED_SCHEMA_VERSION) return { created: false };
  await resetFeed(pglite);
  return { created: true };
}

/** 피드 스키마를 통째로 지우고 빈 스키마를 만든다. */
export async function resetFeed(pglite: PGlite) {
  await pglite.exec("drop schema if exists feed cascade;");
  await pglite.exec(FEED_DDL);
  await pglite.query(
    `insert into feed.meta (key, value) values ('schema_version', $1)`,
    [String(FEED_SCHEMA_VERSION)],
  );
}
