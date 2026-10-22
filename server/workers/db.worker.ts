import { PGlite } from "@electric-sql/pglite";
import { queryCandleData } from "../data/candle-data";
import { queryBarData, queryBoxData } from "../data/category-data";
import {
  queryChartData,
  queryLegendValues,
  queryRowValues,
} from "../data/chart-data";
import { queryColumnSummary } from "../data/column-summary";
import { CsvRejectError } from "../data/csv-import";
import { DatasetManager } from "../data/datasets";
import { queryGanttData } from "../data/gantt-data";
import { queryHeatmapData } from "../data/heatmap-data";
import { queryHistogramData } from "../data/histogram-data";
import { exportItemRows, queryItemRows } from "../data/item-rows";
import { toPieData, toRadarData } from "../data/polar-data";
import { querySankeyData } from "../data/sankey-data";
import {
  getHistory,
  listHistory,
  openHistory,
  saveHistory,
} from "../history/history-store";
import type { DbMethods, Rejectable } from "../protocol";
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

/** 데이터셋 id → 테이블과 스키마. 등록하지 않은 데이터셋이면 던진다. */
async function datasetOf(id: string) {
  const { db, datasets } = await ready;
  const schema = await datasets.schema(id);
  const table = await datasets.table(id);
  if (!schema || !table) throw new Error("dataset is not registered");
  return { db, schema, table };
}

/** CSV 검사에서 거절된 이유는 에러가 아니라 결과로 돌려준다. */
async function rejectable<T>(work: () => Promise<T>): Promise<Rejectable<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (err) {
    if (err instanceof CsvRejectError) return { ok: false, error: err.message };
    throw err;
  }
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

  async datasetStatus({ id }) {
    const { datasets } = await ready;
    return datasets.status(id);
  },

  async ensureDataset({ id }) {
    const { datasets } = await ready;
    return datasets.ensure(id);
  },

  async stageUpload({ fileName, bytes }) {
    const { datasets } = await ready;
    return rejectable(() =>
      datasets.stage({ name: fileName, bytes: new Uint8Array(bytes) }),
    );
  },

  async stageDataset({ id }) {
    const { datasets } = await ready;
    const result = await rejectable(() => datasets.stageExisting(id));
    if (!result.ok) return result;
    return result.value && { ok: true as const, value: result.value };
  },

  async discardStage({ stageId }) {
    const { datasets } = await ready;
    datasets.discardStage(stageId);
    return undefined;
  },

  async previewUpload({ stageId, file, options }) {
    const { datasets } = await ready;
    return rejectable(() => datasets.preview(stageId, file, options));
  },

  async checkUpload({ stageId, options }) {
    const { datasets } = await ready;
    return rejectable(() => datasets.check(stageId, options));
  },

  async commitUpload({ stageId, name, options }) {
    const { datasets } = await ready;
    return rejectable(async () => datasets.commit(stageId, { name, options }));
  },

  async uploadTask({ stageId, since }) {
    const { datasets } = await ready;
    return datasets.waitTask(stageId, since);
  },

  async renameDataset({ id, name }) {
    const { datasets } = await ready;
    return datasets.rename(id, name);
  },

  async removeDataset({ id }) {
    const { datasets } = await ready;
    return datasets.remove(id);
  },

  async datasetColumns({ dataset }) {
    const { datasets } = await ready;
    return datasets.columnInfo(dataset);
  },

  async datasetReady({ dataset }) {
    const { datasets } = await ready;
    return datasets.ready(dataset);
  },

  async splitCount({ dataset, cols, limit, filters }) {
    const { datasets } = await ready;
    return datasets.splitCount(dataset, cols, limit, filters);
  },

  async columnSummary({ dataset, column }) {
    const { db, schema, table } = await datasetOf(dataset);
    return queryColumnSummary(db, table, schema, column);
  },

  async chartData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    const data = await queryChartData(db, schema, { ...params, table });
    return transfer(data, [
      data.xs.buffer,
      data.ys.buffer,
      data.ids.buffer,
      ...(data.legend ? [data.legend.index.buffer] : []),
    ]);
  },

  async legendValues({ dataset, column }) {
    const { db, schema, table } = await datasetOf(dataset);
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

  async categoryData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    const input = { ...params, table };
    return params.chartType === "boxplot"
      ? queryBoxData(db, schema, input)
      : queryBarData(db, schema, input);
  },

  async sankeyData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    return querySankeyData(db, schema, { ...params, table });
  },

  async heatmapData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    return queryHeatmapData(db, schema, { ...params, table });
  },

  async histogramData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    return queryHistogramData(db, schema, { ...params, table });
  },

  async candleData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    return queryCandleData(db, schema, { ...params, table });
  },

  async ganttData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    return queryGanttData(db, schema, { ...params, table });
  },

  async pieData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    const bars = await queryBarData(db, schema, {
      ...params,
      table,
      chartType: "bar",
      legend: null,
    });
    return toPieData(bars);
  },

  async radarData({ dataset, ...params }) {
    const { db, schema, table } = await datasetOf(dataset);
    const bars = await queryBarData(db, schema, {
      ...params,
      table,
      chartType: "bar",
    });
    return toRadarData(bars);
  },

  async itemRows({ dataset, scope, page }) {
    const { datasets } = await ready;
    if (!(await datasets.table(dataset))) return null;
    const { db, schema, table } = await datasetOf(dataset);
    return queryItemRows(db, table, schema, scope, page);
  },

  async exportItemRows({ dataset, scope }) {
    const { datasets } = await ready;
    if (!(await datasets.table(dataset))) return null;
    const { db, schema, table } = await datasetOf(dataset);
    return exportItemRows(db, table, schema, scope);
  },

  async rowValues({ dataset, rowId, columns }) {
    const { datasets } = await ready;
    // 지운 데이터셋이면 null. chart 서비스가 404로 답한다.
    if (!(await datasets.table(dataset))) return null;
    const { db, schema, table } = await datasetOf(dataset);
    return queryRowValues(db, table, schema, rowId, columns);
  },
});
