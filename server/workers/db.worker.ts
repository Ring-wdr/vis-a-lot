import { PGlite } from "@electric-sql/pglite";
import { queryBarData, queryBoxData } from "../data/category-data";
import { queryChartData, queryRowValues } from "../data/chart-data";
import { DatasetManager } from "../data/datasets";
import type { DbMethods } from "../protocol";
import { serveRpc, transfer } from "../rpc";

const started = performance.now();

// PGlite가 비어 있는 IndexedDB에 처음 동기화할 때 내부에서 처리하지 않은
// ENOENT(errno 44)를 한 번 남긴다. 동작에는 영향이 없으므로 이 에러만 debug 로그로 낮춘다.
self.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { name?: string; errno?: number } | undefined;
  if (reason?.name === "ErrnoError" && reason.errno === 44) {
    e.preventDefault();
    console.debug("[db] PGlite idbfs ENOENT on first sync (ignored)");
  }
});

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
  const datasets = await DatasetManager.open(db);
  return { db, datasets, bootMs: performance.now() - started };
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

  async datasetStatuses() {
    const { datasets } = await ready;
    return datasets.statuses();
  },

  async ensureDataset({ rows }) {
    const { datasets } = await ready;
    return datasets.ensure(rows);
  },

  async datasetColumns({ rows }) {
    const { datasets } = await ready;
    return datasets.columns(rows);
  },

  async splitCount({ rows, cols, limit }) {
    const { datasets } = await ready;
    return datasets.splitCount(rows, cols, limit);
  },

  async chartData(params) {
    const { db } = await ready;
    const data = await queryChartData(db, params);
    return transfer(data, [data.xs.buffer, data.ys.buffer, data.ids.buffer]);
  },

  async categoryData(params) {
    const { db } = await ready;
    return params.chartType === "bar"
      ? queryBarData(db, params)
      : queryBoxData(db, params);
  },

  async rowValues({ rows, rowId, columns }) {
    const { db } = await ready;
    return queryRowValues(db, rows, rowId, columns);
  },
});
