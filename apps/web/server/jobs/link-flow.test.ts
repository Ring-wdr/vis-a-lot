import { PGlite } from "@electric-sql/pglite";
import { createMiddleware } from "hono/factory";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ChartSpec, ItemState, JobStateResponse } from "../api/types";
import { getChart, getItem } from "../charts/chart-store";
import { type CategoryDataParams, queryBarData } from "../data/category-data";
import { type ChartDataParams, queryChartData } from "../data/chart-data";
import { type DatasetSchema, schemaOf } from "../data/dataset-schema";
import { type ChartFilter, resolveRowsSources } from "../data/filters";
import {
  countRows,
  type ItemRowsScope,
  queryItemRows,
} from "../data/item-rows";
import { createDb, type Db } from "../db/database";
import type { ServiceEnv } from "../services/common/http";
import { getJob } from "./job-manager";

// 칸 연결 한 바퀴: chart 서비스 API(PUT …/link, POST /charts의 link) → job → 실제 PGlite 조회 → 렌더 입력.
// DB Worker와 Render Worker 자리는 같은 함수를 직접 부르는 가짜로 둔다 (렌더 입력만 적어 둔다).

const dbCall = vi.fn();
const renderCall = vi.fn();
vi.mock("../runtime", () => ({
  getRuntime: () => ({
    db: { call: dbCall },
    render: { call: renderCall, size: 1 },
  }),
}));
vi.mock("../png-store", () => ({
  putPng: async () => {},
  deletePngs: async () => {},
  matchPng: async () => undefined,
}));
vi.mock("../history/recorder", () => ({
  attachHistory: async () => {},
  recordEvent: () => {},
  saveHistory: async () => {},
}));
vi.mock("../services/chart/clients/data-service", () => ({
  DataServiceError: class extends Error {},
  dataService: {
    ensureDataset: async () => ({ state: "ready", done: 1, total: 1 }),
    splitCount: async () => ({ count: 1, exact: true }),
    schema: async (dataset: string) => ({
      columns: datasets[dataset].schema.columns.map((c) => ({
        ...c,
        distinct: null,
      })),
    }),
  },
}));
// 토큰 검증 대신 사용자 한 명으로 통과시킨다.
vi.mock("../services/common/auth", async (original) => ({
  ...(await original<typeof import("../services/common/auth")>()),
  requireAuth: () =>
    createMiddleware<ServiceEnv>(async (c, next) => {
      c.set("principal", { sub: "u1", name: "u1", scopes: [] });
      await next();
    }),
}));
vi.stubGlobal("location", { origin: "http://localhost" });

// iot-100k ↔ iot-1m처럼 컬럼이 같은 두 데이터셋. a: 20행, b: 설비마다 3행
const columns = schemaOf([
  { name: "factory", type: "categorical", label: "공장", nullable: false },
  { name: "machine", type: "categorical", label: "설비", nullable: false },
  { name: "x", type: "numeric", label: "x", nullable: false },
  { name: "value", type: "numeric", label: "값", nullable: false },
]);
const datasets: Record<string, { table: string; schema: DatasetSchema }> = {
  "ds-a": { table: "a", schema: columns },
  "ds-b": { table: "b", schema: columns },
};

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // a: x = value = 0..19, machine = m(i % 5), factory = f(i % 2)
  // b: m0..m4 마다 3행, x = 0..14
  await pglite.exec(`
    create table a (factory text, machine text, x float8, value float8);
    insert into a select 'f' || (i % 2), 'm' || (i % 5), i, i from generate_series(0, 19) i;
    create table b (factory text, machine text, x float8, value float8);
    insert into b select 'f' || (i % 2), 'm' || (i / 3), i, i * 10 from generate_series(0, 14) i;
  `);
  dbCall.mockImplementation(fakeDb);
  renderCall.mockImplementation(async (method: string, input: unknown) => ({
    png: new ArrayBuffer(1),
    meta: {
      chartType: method === "renderScatter" ? "scatter" : "bar",
      x: { domain: [0, 1] },
      y: { domain: [0, 1] },
      input,
    },
  }));
}, 30_000);

/** DB Worker의 해당 메서드처럼: 다른 데이터셋 행 범위의 source를 채워 조회한다. */
async function fakeDb(method: string, params: Record<string, unknown>) {
  const { table, schema } = datasets[params.dataset as string];
  const lookup = async (id: string) => datasets[id];
  const resolve = (filters: unknown) =>
    resolveRowsSources(filters as ChartFilter[] | undefined, lookup);
  if (method === "chartData") {
    const [highlight] = (await resolve(
      params.highlight ? [params.highlight] : undefined,
    )) ?? [undefined];
    return queryChartData(db, schema, {
      ...(params as unknown as ChartDataParams),
      filters: await resolve(params.filters),
      highlight,
      table,
    });
  }
  if (method === "categoryData")
    return queryBarData(db, schema, {
      ...(params as unknown as CategoryDataParams),
      filters: await resolve(params.filters),
      table,
    });
  if (method === "linkRows")
    return countRows(db, table, schema, (await resolve([params.filter])) ?? []);
  if (method === "itemRows") {
    const scope = params.scope as ItemRowsScope;
    return queryItemRows(
      db,
      table,
      schema,
      { ...scope, filters: await resolve(scope.filters) },
      params.page as never,
    );
  }
  throw new Error(`unexpected db call ${method}`);
}

const { chartApp } = await import("../services/chart/app");

const spec = (over: Partial<ChartSpec>): ChartSpec => ({
  dataset: "ds-a",
  chartType: "scatter",
  x: "x",
  y: "value",
  agg: "sum",
  legend: null,
  splitBy: [],
  splitSeparator: " · ",
  tooltip: [],
  grid: { rows: 1, cols: 1 },
  common: { color: "#2a78d6" },
  ...over,
});

async function call(method: string, path: string, body?: unknown) {
  const res = await chartApp.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** job이 끝날 때까지 기다린다. */
async function settle(jobId: string) {
  for (let i = 0; i < 200; i++) {
    const job = getJob(jobId);
    if (job && ["success", "failed", "cancelled"].includes(job.status)) {
      expect(job.status).toBe("success");
      return;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

/** 결과와 상관없이 job이 끝날 때까지 기다린다. */
async function ended(jobId: string) {
  for (let i = 0; i < 200; i++) {
    const job = getJob(jobId);
    if (job && ["success", "failed", "cancelled"].includes(job.status)) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

/** 칸 하나를 그리고 끝날 때까지 기다린다. */
async function draw(s: ChartSpec, link?: unknown) {
  const res = await call("POST", "/charts", {
    spec: s,
    itemSize: { width: 400, height: 300 },
    record: false,
    ...(link ? { link } : {}),
  });
  expect(res.status).toBe(202);
  await settle(res.body.jobId);
  const chart = getChart(res.body.chartId);
  const key = chart?.items?.[0]?.key as string;
  return { chartId: res.body.chartId as string, key };
}

/** 그 차트의 마지막 렌더 입력 */
function lastInput(chartId: string) {
  // 가짜 렌더가 metadata에 렌더 입력을 담아 돌려준다.
  const meta = getChart(chartId)?.items?.[0]?.meta as unknown as {
    input: never;
  };
  return meta.input as {
    categories: string[];
    bars?: (number | null)[][];
    xs: Float64Array;
    ids: Float64Array;
    linked?: Uint8Array;
    note?: string;
  };
}

/** item 상태 (primary job) */
async function itemState(chartId: string): Promise<ItemState> {
  const chart = getChart(chartId);
  const job = chart?.primaryJobId as string;
  const res = await call("GET", `/jobs/${job}?page=0&pageSize=1&since=-1`);
  return (res.body as JobStateResponse).items[0] as ItemState;
}

async function select(chartId: string, key: string, region: unknown) {
  const res = await call(
    "PUT",
    `/charts/${chartId}/items/${encodeURIComponent(key)}/selection`,
    { region },
  );
  expect(res.status).toBe(202);
  await settle(res.body.jobId);
}

async function link(chartId: string, body: unknown) {
  return call("PUT", `/charts/${chartId}/link`, { link: body });
}

const rect = (x0: number, x1: number) => ({
  type: "rect",
  x0,
  y0: -1000,
  x1,
  y1: 1000,
});

describe("칸 연결", () => {
  it("scatter 선택 → 같은 데이터셋 bar 거르기, 범위가 같으면 다시 그리지 않고, 선택을 풀면 돌아온다", async () => {
    const scatter = await draw(spec({}));
    const bar = await draw(spec({ chartType: "bar", x: "machine" }));
    // 전체: 설비마다 4행 → 합계는 m0 = 0+5+10+15 = 30
    expect(lastInput(bar.chartId).categories).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
    ]);

    // x 0..6 선택 → 행 0~6: m0(0,5) m1(1,6) m2(2) m3(3) m4(4)
    await select(scatter.chartId, scatter.key, rect(-0.5, 6.5));
    const source = { chartId: scatter.chartId, itemKey: scatter.key };
    const primary = getChart(bar.chartId)?.primaryJobId;
    const first = await link(bar.chartId, { source, mode: "filter" });
    expect(first.status).toBe(202);
    // item 다시 그리기다: 화면이 보는 draw job은 그대로이고, 다시 그리는 동안 이전 PNG를 둔다.
    expect(getChart(bar.chartId)?.primaryJobId).toBe(primary);
    const barChart = getChart(bar.chartId);
    expect(barChart && getItem(barChart, bar.key)?.busyJobId).toBe(
      first.body.jobId,
    );
    await settle(first.body.jobId);
    const input = lastInput(bar.chartId);
    expect(input.bars?.map((row) => row[0])).toEqual([5, 7, 2, 3, 4]);
    expect(input.note).toBe("연결 7행");
    expect((await itemState(bar.chartId)).link).toEqual({
      rows: 7,
      mode: "filter",
    });

    // 데이터 표도 거르기 범위를 따른다.
    const rows = await call(
      "POST",
      `/charts/${bar.chartId}/items/${encodeURIComponent(bar.key)}/rows`,
      { offset: 0, limit: 100 },
    );
    expect(rows.body.total).toBe(7);

    // 범위가 그대로면 다시 그리지 않는다.
    const again = await link(bar.chartId, { source, mode: "filter" });
    expect(again).toEqual({ status: 200, body: { jobId: null } });

    // 따를 칸을 확대해도 고정한 범위는 그대로다.
    const zoom = await call(
      "POST",
      `/charts/${scatter.chartId}/items/${encodeURIComponent(scatter.key)}/view`,
      { type: "zoomIn", x: [0, 3], y: [0, 3] },
    );
    await settle(zoom.body.jobId);
    expect((await link(bar.chartId, { source, mode: "filter" })).body).toEqual({
      jobId: null,
    });

    // 선택을 풀면 범위도 풀린다.
    await select(scatter.chartId, scatter.key, null);
    const cleared = await link(bar.chartId, { source, mode: "filter" });
    expect(cleared.status).toBe(202);
    await settle(cleared.body.jobId);
    expect(lastInput(bar.chartId).bars?.map((row) => row[0])).toEqual([
      30, 34, 38, 42, 46,
    ]);
    expect(lastInput(bar.chartId).note).toBeUndefined();
    expect((await itemState(bar.chartId)).link).toBeUndefined();
  });

  it("scatter 선택 → 다른 데이터셋 scatter 강조를 machine 컬럼으로 잇는다", async () => {
    const scatter = await draw(spec({}));
    const other = await draw(spec({ dataset: "ds-b" }));
    // x 0..1 선택 → a의 행 0·1: m0, m1 → b의 행 0~5 (m0·m1)
    await select(scatter.chartId, scatter.key, rect(-0.5, 1.5));
    const res = await link(other.chartId, {
      source: { chartId: scatter.chartId, itemKey: scatter.key },
      mode: "highlight",
      on: { source: "machine", target: "machine" },
    });
    expect(res.status).toBe(202);
    await settle(res.body.jobId);
    const input = lastInput(other.chartId);
    // 강조는 거르지 않는다: 15행을 모두 그리고 행마다 범위 안인지 받는다.
    expect(input.xs.length).toBe(15);
    expect([...(input.linked ?? [])]).toEqual([
      1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(input.note).toBe("연결 강조 6행");
    // 강조일 때 데이터 표는 그린 행 전부다.
    const rows = await call(
      "POST",
      `/charts/${other.chartId}/items/${encodeURIComponent(other.key)}/rows`,
      { offset: 0, limit: 100 },
    );
    expect(rows.body.total).toBe(15);
  });

  it("그릴 때 함께 건다 (POST /charts의 link)", async () => {
    const scatter = await draw(spec({}));
    await select(scatter.chartId, scatter.key, rect(9.5, 12.5));
    const bar = await draw(spec({ chartType: "bar", x: "machine" }), {
      source: { chartId: scatter.chartId, itemKey: scatter.key },
      mode: "filter",
    });
    // 행 10·11·12: m0(10) m1(11) m2(12)
    expect(lastInput(bar.chartId).categories).toEqual(["m0", "m1", "m2"]);
    expect((await itemState(bar.chartId)).link).toEqual({
      rows: 3,
      mode: "filter",
    });
  });

  it("거절: 404·409·422", async () => {
    const scatter = await draw(spec({}));
    const bar = await draw(spec({ chartType: "bar", x: "machine" }));
    const other = await draw(spec({ dataset: "ds-b" }));
    const source = { chartId: scatter.chartId, itemKey: scatter.key };

    expect((await link("nope", { source, mode: "filter" })).status).toBe(404);
    expect(
      (
        await link(bar.chartId, {
          source: { chartId: "nope", itemKey: "x" },
          mode: "filter",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await link(bar.chartId, {
          source: { ...source, itemKey: "nope" },
          mode: "filter",
        })
      ).status,
    ).toBe(404);

    // 강조는 scatter·line만
    const highlightBar = await link(bar.chartId, {
      source,
      mode: "highlight",
    });
    expect(highlightBar.status).toBe(422);
    // 데이터셋이 다른데 연결 컬럼이 없다 / 스키마에 없다
    expect((await link(other.chartId, { source, mode: "filter" })).status).toBe(
      422,
    );
    const missing = await link(other.chartId, {
      source,
      mode: "filter",
      on: { source: "machine", target: "nope" },
    });
    expect(missing.status).toBe(422);
    expect(missing.body.error).toContain("nope");
    // 선택을 행으로 바꿀 수 없는 차트는 따를 수 없다
    const treemap = await draw(spec({ chartType: "treemap", x: "machine" }));
    expect(
      (
        await link(bar.chartId, {
          source: { chartId: treemap.chartId, itemKey: treemap.key },
          mode: "filter",
        })
      ).status,
    ).toBe(422);
    // 자기 자신
    expect(
      (await link(scatter.chartId, { source, mode: "filter" })).status,
    ).toBe(422);
    // POST /charts의 link도 같은 사유로 거절한다
    const post = await call("POST", "/charts", {
      spec: spec({ chartType: "bar", x: "machine" }),
      itemSize: { width: 400, height: 300 },
      record: false,
      link: { source, mode: "highlight" },
    });
    expect(post.status).toBe(422);

    // 그리는 중이면 409
    const drawing = await call("POST", "/charts", {
      spec: spec({ chartType: "bar", x: "machine" }),
      itemSize: { width: 400, height: 300 },
      record: false,
    });
    expect(
      (await link(drawing.body.chartId, { source, mode: "filter" })).status,
    ).toBe(409);
    await settle(drawing.body.jobId);
  });

  it("따를 칸을 그리지 못했으면 범위를 푼다, 이 칸을 그리지 못했으면 409", async () => {
    const scatter = await draw(spec({}));
    const bar = await draw(spec({ chartType: "bar", x: "machine" }));
    await select(scatter.chartId, scatter.key, rect(-0.5, 0.5));
    const set = await link(bar.chartId, {
      source: { chartId: scatter.chartId, itemKey: scatter.key },
      mode: "filter",
    });
    await settle(set.body.jobId);
    expect((await itemState(bar.chartId)).link?.rows).toBe(1);

    // 따를 칸을 새로 그렸는데 실패했다 (없는 컬럼): 선택이 없으므로 범위를 푼다.
    const broken = await call("POST", "/charts", {
      spec: spec({ x: "nope" }),
      itemSize: { width: 400, height: 300 },
      record: false,
    });
    const source = { chartId: broken.body.chartId, itemKey: scatter.key };
    await ended(broken.body.jobId);
    expect(getJob(broken.body.jobId)?.status).toBe("failed");
    const cleared = await link(bar.chartId, { source, mode: "filter" });
    expect(cleared.status).toBe(202);
    await settle(cleared.body.jobId);
    expect((await itemState(bar.chartId)).link).toBeUndefined();
    expect((await link(bar.chartId, { source, mode: "filter" })).body).toEqual({
      jobId: null,
    });

    // 실패한 칸에 걸면 까닭을 알린다.
    const res = await link(broken.body.chartId, {
      source: { chartId: scatter.chartId, itemKey: scatter.key },
      mode: "filter",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("그리지 못해");
  });

  it("범위가 바뀌면 조회 결과를 버리고 다시 조회한다", async () => {
    const scatter = await draw(spec({}));
    const bar = await draw(spec({ chartType: "bar", x: "machine" }));
    const source = { chartId: scatter.chartId, itemKey: scatter.key };
    await select(scatter.chartId, scatter.key, rect(-0.5, 0.5));
    dbCall.mockClear();
    const res = await link(bar.chartId, { source, mode: "filter" });
    await settle(res.body.jobId);
    expect(dbCall.mock.calls.map(([m]) => m)).toEqual([
      "linkRows",
      "categoryData",
    ]);
    expect(lastInput(bar.chartId).categories).toEqual(["m0"]);
  });
});
