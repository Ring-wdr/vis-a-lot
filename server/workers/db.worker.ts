import { PGlite } from "@electric-sql/pglite";
import { queryBarData, queryBoxData } from "../data/category-data";
import {
  queryChartData,
  queryLegendValues,
  queryRowValues,
} from "../data/chart-data";
import { queryColumnSummary } from "../data/column-summary";
import { DatasetManager } from "../data/datasets";
import { type RowSize, readingsTable } from "../data/schema";
import {
  getHistory,
  listHistory,
  openHistory,
  saveHistory,
} from "../history/history-store";
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
  await openHistory(db);
  return { db, datasets, bootMs: performance.now() - started };
});

/** 행 수 → 테이블과 스키마. 등록하지 않은 데이터셋이면 던진다. */
async function datasetOf(rows: RowSize) {
  const { db, datasets } = await ready;
  const schema = await datasets.schema(rows);
  if (!schema) throw new Error("dataset is not registered");
  return { db, schema, table: readingsTable(rows) };
}

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
    return datasets.columnInfo(rows);
  },

  async datasetReady({ rows }) {
    const { datasets } = await ready;
    return datasets.ready(rows);
  },

  async splitCount({ rows, cols, limit, filters }) {
    const { datasets } = await ready;
    return datasets.splitCount(rows, cols, limit, filters);
  },

  async columnSummary({ rows, column }) {
    const { db, schema, table } = await datasetOf(rows);
    return queryColumnSummary(db, table, schema, column);
  },

  async chartData({ rows, ...params }) {
    const { db, schema, table } = await datasetOf(rows);
    const data = await queryChartData(db, schema, { ...params, table });
    return transfer(data, [
      data.xs.buffer,
      data.ys.buffer,
      data.ids.buffer,
      ...(data.legend ? [data.legend.index.buffer] : []),
    ]);
  },

  async legendValues({ rows, column }) {
    const { db, schema, table } = await datasetOf(rows);
    return queryLegendValues(db, table, schema, column);
  },

  async historySave(entry) {
    const { db } = await ready;
    await saveHistory(db, entry);
    return undefined;
  },

  async historyList() {
    const { db } = await ready;
    return listHistory(db);
  },

  async historyGet({ id }) {
    const { db } = await ready;
    return getHistory(db, id);
  },

  async categoryData({ rows, ...params }) {
    const { db, schema, table } = await datasetOf(rows);
    const input = { ...params, table };
    return params.chartType === "bar"
      ? queryBarData(db, schema, input)
      : queryBoxData(db, schema, input);
  },

  async rowValues({ rows, rowId, columns }) {
    const { db, schema, table } = await datasetOf(rows);
    return queryRowValues(db, table, schema, rowId, columns);
  },
});
