import { describe, expect, it } from "vitest";
import { FEED_SCHEMA_VERSION } from "./ddl";
import { migrateFeed } from "./migrate";
import { createTestFeed } from "./test-db";

describe("피드 스키마", () => {
  it("빈 스키마를 만들고 system.status가 0을 돌려준다", async () => {
    const t = await createTestFeed();
    expect(await t.run("system.status", undefined)).toEqual({
      users: 0,
      posts: 0,
    });
  });

  it("모르는 사용자는 401", async () => {
    const t = await createTestFeed();
    await expect(
      t.run("system.status", undefined, { actor: "nobody" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("v1 DB는 데이터를 두고 v2 인덱스만 더하고 통계를 모은다", async () => {
    const t = await createTestFeed();
    // v1처럼: v2 인덱스 하나를 지우고 버전을 1로 되돌린 뒤 사용자 하나를 넣는다
    await t.pglite.exec(`
      drop index feed.posts_parent_id_idx;
      update feed.meta set value = '1' where key = 'schema_version';
      insert into feed.users (id, name) values ('u1', '가');
    `);
    expect(await migrateFeed(t.pglite)).toEqual({ created: false });

    const meta = await t.pglite.query<{ value: string }>(
      `select value from feed.meta where key = 'schema_version'`,
    );
    expect(meta.rows[0].value).toBe(String(FEED_SCHEMA_VERSION));
    expect(await t.run("system.status", undefined)).toMatchObject({
      users: 1,
    });
    const index = await t.pglite.query(
      `select 1 from pg_indexes where schemaname = 'feed' and indexname = 'posts_parent_id_idx'`,
    );
    expect(index.rows).toHaveLength(1);
    const unanalyzed = await t.pglite.query<{ n: number }>(
      `select count(*)::int as n from pg_class
         where relnamespace = 'feed'::regnamespace and relkind = 'r' and reltuples < 0`,
    );
    expect(unanalyzed.rows[0].n).toBe(0);
  });

  it("모르는 예전 버전은 지우고 새로 만든다", async () => {
    const t = await createTestFeed();
    await t.pglite.exec(`
      update feed.meta set value = '0' where key = 'schema_version';
      insert into feed.users (id, name) values ('u1', '가');
    `);
    expect(await migrateFeed(t.pglite)).toEqual({ created: true });
    expect(await t.run("system.status", undefined)).toMatchObject({
      users: 0,
    });
  });
});
