// 피드 스키마 만들기와 버전 관리. DB Worker가 부팅할 때 부른다.

import type { PGlite } from "@electric-sql/pglite";
import { FEED_DDL, FEED_INDEXES_V2, FEED_SCHEMA_VERSION } from "./ddl";

/** 지우지 않고 올릴 수 있는 버전: 이전 버전 → 올릴 때 실행할 DDL */
const UPGRADES: Record<number, string> = {
  1: FEED_INDEXES_V2,
};

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

/**
 * 버전이 다르면 피드 스키마를 지우고 새로 만든다. 프로토타입이라 데이터 이전은 하지 않는다(시드로 다시 채운다).
 * 인덱스만 더한 버전(UPGRADES)은 데이터를 두고 DDL만 실행한다.
 */
export async function migrateFeed(pglite: PGlite) {
  const version = await currentVersion(pglite);
  if (version === FEED_SCHEMA_VERSION) {
    await analyzeFeedIfNeeded(pglite);
    return { created: false };
  }
  const upgrade = UPGRADES[version];
  if (upgrade && version + 1 === FEED_SCHEMA_VERSION) {
    await pglite.exec(upgrade);
    await pglite.query(
      `update feed.meta set value = $1 where key = 'schema_version'`,
      [String(FEED_SCHEMA_VERSION)],
    );
    await analyzeFeed(pglite);
    return { created: false };
  }
  await resetFeed(pglite);
  return { created: true };
}

/**
 * 피드 테이블의 플래너 통계를 다시 모은다. PGlite는 autovacuum이 돌지 않아 ANALYZE를 직접 부르지 않으면
 * 통계가 영영 없고, 플래너가 행 수를 기본값으로 어림해 계획을 잘못 고른다. 시드·리셋·가져오기 뒤에 부른다.
 */
export async function analyzeFeed(pglite: PGlite) {
  const tables = await pglite.query<{ name: string }>(
    `select format('%I.%I', schemaname, tablename) as name from pg_tables where schemaname = 'feed'`,
  );
  if (tables.rows.length === 0) return;
  await pglite.exec(`analyze ${tables.rows.map((t) => t.name).join(", ")}`);
}

/** 한 번도 ANALYZE하지 않은 피드 테이블(reltuples < 0)이 있으면 통계를 모은다 (예전 DB를 처음 열 때) */
async function analyzeFeedIfNeeded(pglite: PGlite) {
  const missing = await pglite.query<{ n: number }>(
    `select count(*)::int as n from pg_class
       where relnamespace = 'feed'::regnamespace and relkind = 'r' and reltuples < 0`,
  );
  if ((missing.rows[0]?.n ?? 0) > 0) await analyzeFeed(pglite);
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
