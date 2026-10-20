import { PGlite } from "@electric-sql/pglite";
import type { DbMethods } from "../protocol";
import { serveRpc } from "../rpc";

const started = performance.now();

// IndexedDB에 저장해서 새로고침해도 데이터가 남는다.
const ready = PGlite.create("idb://vis-a-lot", {
  relaxedDurability: true,
}).then(async (db) => {
  await db.exec(`
      create table if not exists boot_log (
        id serial primary key,
        booted_at timestamptz not null default now()
      );
      insert into boot_log default values;
    `);
  return { db, bootMs: performance.now() - started };
});

serveRpc<DbMethods>({
  async ping() {
    const { db, bootMs } = await ready;
    const version = await db.query<{ version: string }>("select version()");
    const boots = await db.query<{ count: number }>(
      "select count(*)::int as count from boot_log",
    );
    return {
      version: version.rows[0].version,
      bootCount: boots.rows[0].count,
      bootMs,
    };
  },

  async query({ sql, params }) {
    const { db } = await ready;
    const result = await db.query<Record<string, unknown>>(sql, params);
    return { rows: result.rows };
  },
});
