// DB 벤치마크: 브라우저 대신 Node에서 PGlite를 임베디드(파일 저장)로 띄워 피드 op와 차트 데이터 쿼리를 잰다.
// 쿼리마다 걸린 시간을 모으고, 오래 걸린 select는 EXPLAIN (ANALYZE, BUFFERS)로 실행 계획을 남긴다.
//
// 사용: pnpm bench:db [--scale 1] [--rows 1000000] [--iterations 15] [--memory]
//                     [--skip-feed] [--skip-data] [--extra-sql file.sql]
//                     [--out result.json] [--explain-top 3]

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { queryBarData, queryBoxData } from "../../server/data/category-data";
import {
  queryChartData,
  queryLegendValues,
} from "../../server/data/chart-data";
import { queryColumnSummary } from "../../server/data/column-summary";
import { DatasetManager } from "../../server/data/datasets";
import type { ChartFilter } from "../../server/data/filters";
import { START_MS } from "../../server/data/generator";
import { queryHeatmapData } from "../../server/data/heatmap-data";
import { queryHistogramData } from "../../server/data/histogram-data";
import { queryItemRows } from "../../server/data/item-rows";
import { querySampleRows } from "../../server/data/sample-rows";
import * as database from "../../server/db/database";
import { createFeedDb } from "../../server/feed/db";
import * as migrate from "../../server/feed/migrate";
import type { FeedArgs, FeedOpName } from "../../server/feed/ops";
import { runFeedOp } from "../../server/feed/runner";
import { loadFeedFixture } from "./feed-fixture";

const { values: opts } = parseArgs({
  options: {
    scale: { type: "string", default: "1" },
    rows: { type: "string", default: "1000000" },
    iterations: { type: "string", default: "15" },
    memory: { type: "boolean", default: false },
    "skip-feed": { type: "boolean", default: false },
    "skip-data": { type: "boolean", default: false },
    "extra-sql": { type: "string" },
    out: { type: "string" },
    "explain-top": { type: "string", default: "3" },
  },
});

const ITERATIONS = Number(opts.iterations);
const EXPLAIN_TOP = Number(opts["explain-top"]);

type Statement = { sql: string; params: readonly unknown[]; ms: number };
type CaseResult = {
  name: string;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  statements: number;
  /** 한 번 실행에서 오래 걸린 문장 */
  top: { ms: number; sql: string; plan?: string }[];
};

let captured: Statement[] = [];
let capturing = true;

/**
 * Kysely를 거치든(피드) 원본 드라이버로 바로 가든(차트 데이터) 모든 문장을 PGlite에서 잰다.
 * Kysely 트랜잭션은 pglite.transaction의 tx.query로 돌므로 그쪽도 감싼다.
 */
function captureQueries(pglite: PGlite) {
  type Queryable = Pick<PGlite, "query">;
  const wrap = (target: Queryable) => {
    const query = target.query.bind(target);
    target.query = (async (
      sql: string,
      params?: unknown[],
      options?: never,
    ) => {
      const started = performance.now();
      try {
        return await query(sql, params, options);
      } finally {
        if (capturing)
          captured.push({
            sql,
            params: params ?? [],
            ms: performance.now() - started,
          });
      }
    }) as PGlite["query"];
  };
  wrap(pglite);
  const transaction = pglite.transaction.bind(pglite);
  pglite.transaction = ((callback: (tx: Queryable) => Promise<unknown>) =>
    transaction((tx) => {
      wrap(tx);
      return callback(tx);
    })) as PGlite["transaction"];
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { medianMs: at(0.5), p95Ms: at(0.95), minMs: sorted[0] };
}

const round = (ms: number) => Math.round(ms * 100) / 100;

async function explain(pglite: PGlite, s: Statement) {
  if (!/^\s*(select|with)\b/i.test(s.sql)) return undefined;
  capturing = false;
  try {
    const res = await pglite.query<{ "QUERY PLAN": string }>(
      `explain (analyze, buffers) ${s.sql}`,
      [...s.params],
    );
    return res.rows.map((r) => r["QUERY PLAN"]).join("\n");
  } finally {
    capturing = true;
  }
}

/** 한 케이스를 warmup 2번 뒤 ITERATIONS번 잰다. 마지막 실행의 문장으로 느린 쿼리를 고른다 */
async function measure(
  pglite: PGlite,
  name: string,
  run: (i: number) => Promise<unknown>,
  iterations = ITERATIONS,
): Promise<CaseResult> {
  for (let i = 0; i < 2; i++) await run(-1 - i);
  const samples: number[] = [];
  let last: Statement[] = [];
  for (let i = 0; i < iterations; i++) {
    captured = [];
    const started = performance.now();
    await run(i);
    samples.push(performance.now() - started);
    last = captured;
  }
  const slow = [...last].sort((a, b) => b.ms - a.ms).slice(0, EXPLAIN_TOP);
  const top = [];
  for (const s of slow)
    top.push({
      ms: round(s.ms),
      sql: s.sql,
      plan: s.ms >= 1 ? await explain(pglite, s) : undefined,
    });
  const result = { name, ...stats(samples), statements: last.length, top };
  console.log(
    `${name.padEnd(42)} median ${round(result.medianMs).toFixed(2).padStart(9)} ms  p95 ${round(result.p95Ms).toFixed(2).padStart(9)} ms  (${last.length} stmts)`,
  );
  return result;
}

async function benchFeed(pglite: PGlite) {
  await migrate.migrateFeed(pglite);
  const started = performance.now();
  const fixture = await loadFeedFixture(pglite, { scale: Number(opts.scale) });
  const loadMs = performance.now() - started;
  console.log(
    `feed fixture loaded in ${Math.round(loadMs)} ms`,
    fixture.counts,
  );
  if (opts["extra-sql"])
    await pglite.exec(readFileSync(opts["extra-sql"], "utf8"));
  // 앱이 시드·가져오기 뒤(feedFlush)에 하는 것처럼 통계를 모은다
  // (예전 코드와 비교할 때는 그 코드에 없는 설정·함수를 건너뛴다. 아래 database.*도 같다)
  const analyzeStarted = performance.now();
  const { analyzeFeed } = migrate as Partial<typeof migrate>;
  if (analyzeFeed) await analyzeFeed(pglite);
  const analyzeMs = performance.now() - analyzeStarted;

  const db = createFeedDb(pglite);
  const now = fixture.now.getTime();
  const actor = fixture.actorId;
  const op = <K extends FeedOpName>(
    name: K,
    args: FeedArgs<K>,
    actorId: string | null = actor,
  ) =>
    runFeedOp(db, { op: name, args, actorId, now }).then((reply) => {
      if (!reply.ok) throw new Error(`${name}: ${reply.status} ${reply.error}`);
      return reply.value;
    });
  const [recentKey, midKey, oldKey] = fixture.samplePostKeys;
  const group = fixture.privateGroupIds[0];
  const day = (offset: number) =>
    new Date(now + offset * 86_400_000).toISOString().slice(0, 10);

  const results: CaseResult[] = [];
  const m = async (
    name: string,
    run: (i: number) => Promise<unknown>,
    n?: number,
  ) => results.push(await measure(pglite, name, run, n));

  // 읽기
  await m("posts.query 탐색(최근 수정순 50)", () =>
    op("posts.query", { limit: 50 }),
  );
  await m("posts.query 홈(고정 먼저)", () =>
    op("posts.query", { limit: 50, pinnedFirst: true }),
  );
  await m("posts.query 2페이지(offset 1000)", () =>
    op("posts.query", { limit: 50, offset: 1000 }),
  );
  await m("posts.query 그룹+상태", () =>
    op("posts.query", {
      filter: { groupIds: [group], statuses: ["in_progress"] },
      limit: 50,
    }),
  );
  await m("posts.query 내 담당(열림)", () =>
    op("posts.query", {
      filter: { mine: "assigned", categories: ["open"] },
      limit: 50,
    }),
  );
  await m("posts.query 이해관계자", () =>
    op("posts.query", { filter: { mine: "stakeholder" }, limit: 50 }),
  );
  await m("posts.query 관심(팔로우)", () =>
    op("posts.query", { filter: { followedAuthors: true }, limit: 50 }),
  );
  await m("posts.query 태그", () =>
    op("posts.query", { filter: { tags: ["센서"] }, limit: 50 }),
  );
  await m("posts.query 기한순", () =>
    op("posts.query", {
      sort: { field: "dueDate", dir: "asc" },
      filter: { categories: ["open"] },
      limit: 50,
    }),
  );
  await m("posts.query 키순", () =>
    op("posts.query", { sort: { field: "key", dir: "asc" }, limit: 50 }),
  );
  await m("posts.query 상태순", () =>
    op("posts.query", { sort: { field: "status", dir: "asc" }, limit: 50 }),
  );
  await m("posts.query 기한 초과", () =>
    op("posts.query", { filter: { overdue: true }, limit: 50 }),
  );
  await m("posts.query 글자(q)", () =>
    op("posts.query", { filter: { q: "진동 경보" }, limit: 50 }),
  );
  await m("posts.query 보드 500", () =>
    op("posts.query", { filter: { groupIds: [group] }, limit: 500 }),
  );
  await m("posts.mySummary", () => op("posts.mySummary", undefined as never));
  await m("posts.get 최근", () => op("posts.get", { postId: recentKey }));
  await m("posts.get 오래된", () => op("posts.get", { postId: oldKey }));
  await m("comments.list", () => op("comments.list", { postId: midKey }));
  await m("search.posts 키", () => op("search.posts", { q: "GA-12" }));
  await m("search.posts 글자", () => op("search.posts", { q: "대시보드" }));
  await m("search.posts 없는 말", () => op("search.posts", { q: "없는말xyz" }));
  await m("notifications.inbox", () => op("notifications.inbox", {}));
  await m("notifications.inbox 안읽음", () =>
    op("notifications.inbox", { unreadOnly: true }),
  );
  await m("notifications.unreadCount", () =>
    op("notifications.unreadCount", undefined as never),
  );
  await m("views.list", () => op("views.list", {}));
  await m("users.list", () => op("users.list", undefined as never));
  await m("groups.list", () => op("groups.list", undefined as never));
  await m("reports.activity 30일", () =>
    op("reports.activity", { groupId: group, from: day(-30), to: day(0) }),
  );
  await m("reports.status", () => op("reports.status", { groupId: group }));
  await m("scheduler.run", () => op("scheduler.run", undefined as never, null));

  // 쓰기 (매번 새 행). 같은 게시물에 계속 쓰지 않도록 회차마다 대상을 바꾼다
  await m("posts.create", (i) =>
    op("posts.create", {
      groupId: group,
      title: `벤치 게시물 ${i}`,
      body: { type: "doc", content: [] },
      assigneeId: actor,
    }),
  );
  await m("comments.create", (i) =>
    op("comments.create", {
      postId: i % 2 ? recentKey : midKey,
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: `벤치 ${i}` }] },
        ],
      },
    }),
  );
  await m("posts.update 우선순위", (i) =>
    op(
      "posts.update",
      { postId: recentKey, priority: (i + 10) % 5 },
      fixture.adminId,
    ),
  );
  await m(
    "notifications.markRead",
    async () => {
      const inbox = (await op("notifications.inbox", { unreadOnly: true })) as {
        groups: { notifications: { id: string }[] }[];
      };
      const ids = inbox.groups.flatMap((g) => g.notifications.map((n) => n.id));
      await op("notifications.markUnread", { ids: ids.slice(0, 20) });
    },
    5,
  );

  return { fixture: { ...fixture, loadMs, analyzeMs }, results };
}

async function benchData(pglite: PGlite) {
  const db = database.createDb(pglite);
  const manager = await DatasetManager.open(db);
  const rows = Number(opts.rows);
  const id =
    rows === 100_000 ? "iot-100k" : rows === 500_000 ? "iot-500k" : "iot-1m";
  const started = performance.now();
  await manager.ensure(id);
  while ((await manager.status(id))?.state !== "ready")
    await new Promise((r) => setTimeout(r, 200));
  const loadMs = performance.now() - started;
  console.log(`dataset ${id} loaded in ${Math.round(loadMs)} ms`);
  if (opts["extra-sql"])
    await pglite.exec(readFileSync(opts["extra-sql"], "utf8"));
  const table = (await manager.table(id)) as string;
  const schema = (await manager.schema(id)) as NonNullable<
    Awaited<ReturnType<DatasetManager["schema"]>>
  >;
  const q = db;
  const week = 7 * 86_400_000;
  const tsFilter: ChartFilter = {
    kind: "range",
    column: "ts",
    min: START_MS + week,
    max: START_MS + 2 * week,
    inverse: false,
    includeNull: false,
  };
  const exclude: ChartFilter = {
    kind: "exclude",
    column: "status",
    values: ["정상"],
  };
  const results: CaseResult[] = [];
  const m = async (name: string, run: () => Promise<unknown>, n = 5) =>
    results.push(await measure(pglite, name, run, n));

  await m("scatter ts×value", () =>
    queryChartData(q, schema, {
      table,
      x: "ts",
      y: "value",
      splitBy: [],
      legend: null,
    }),
  );
  await m("scatter split factory×line + legend", () =>
    queryChartData(q, schema, {
      table,
      x: "ts",
      y: "value",
      splitBy: ["factory", "line"],
      legend: "sensor_type",
    }),
  );
  await m("scatter ts 1주 필터", () =>
    queryChartData(q, schema, {
      table,
      x: "ts",
      y: "value",
      splitBy: [],
      legend: null,
      filters: [tsFilter],
    }),
  );
  await m("bar avg value by machine split factory", () =>
    queryBarData(q, schema, {
      table,
      chartType: "bar",
      x: "machine",
      y: "value",
      agg: "avg",
      splitBy: ["factory"],
      legend: null,
    }),
  );
  await m("bar median by line legend sensor", () =>
    queryBarData(q, schema, {
      table,
      chartType: "bar",
      x: "line",
      y: "value",
      agg: "median",
      splitBy: [],
      legend: "sensor_type",
    }),
  );
  await m("boxplot value by sensor_type", () =>
    queryBoxData(q, schema, {
      table,
      chartType: "boxplot",
      x: "sensor_type",
      y: "value",
      agg: "avg",
      splitBy: [],
      legend: null,
    }),
  );
  await m("histogram value split sensor", () =>
    queryHistogramData(q, schema, {
      table,
      x: "value",
      splitBy: ["sensor_type"],
      legend: null,
    }),
  );
  await m("heatmap ts×machine avg", () =>
    queryHeatmapData(q, schema, {
      table,
      x: "ts",
      y: "machine",
      z: "value",
      agg: "avg",
      splitBy: [],
    }),
  );
  await m("legendValues sensor_type", () =>
    queryLegendValues(q, table, schema, "sensor_type"),
  );
  await m("columnSummary machine", () =>
    queryColumnSummary(q, table, schema, "machine"),
  );
  await m("columnSummary ts", () => queryColumnSummary(q, table, schema, "ts"));
  await m("splitCount 3컬럼", () =>
    manager.splitCount(id, ["factory", "line", "lot_id"], 30_000),
  );
  await m("splitCount 필터", () =>
    manager.splitCount(id, ["machine", "lot_id"], 30_000, [exclude]),
  );
  await m("sampleRows 필터 1페이지", () =>
    querySampleRows(q, table, schema, [exclude], { offset: 0, limit: 100 }),
  );
  await m("itemRows split 조합 1페이지", () =>
    queryItemRows(
      q,
      table,
      schema,
      {
        chartType: "scatter",
        x: "ts",
        y: "value",
        legend: null,
        splitBy: ["factory", "line"],
        splitValues: ["판교", "L1"],
        columns: ["ts", "value", "machine"],
        deletions: [],
      },
      { offset: 0, limit: 100 },
    ),
  );
  return { dataset: { id, rows, loadMs }, results };
}

async function main() {
  const dir = opts.memory
    ? undefined
    : mkdtempSync(path.join(os.tmpdir(), "vis-a-lot-bench-"));
  const started = performance.now();
  // DB Worker와 같은 설정으로 띄운다
  const pglite = await PGlite.create(dir ?? "memory://", {
    relaxedDurability: true,
    extensions: (database as Partial<typeof database>).PGLITE_EXTENSIONS,
  });
  const settings = (database as Partial<typeof database>).PLANNER_SETTINGS;
  if (settings) await pglite.exec(settings);
  const bootMs = performance.now() - started;
  captureQueries(pglite);
  const version = (await pglite.query<{ version: string }>("select version()"))
    .rows[0].version;
  console.log(
    `PGlite ${dir ? `file ${dir}` : "memory"} boot ${Math.round(bootMs)} ms — ${version}`,
  );
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    node: process.version,
    postgres: version,
    storage: dir ? "file" : "memory",
    options: opts,
    bootMs,
  };
  try {
    if (!opts["skip-feed"]) report.feed = await benchFeed(pglite);
    if (!opts["skip-data"]) report.data = await benchData(pglite);
  } finally {
    await pglite.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2));
    console.log(`wrote ${opts.out}`);
  }
}

await main();
