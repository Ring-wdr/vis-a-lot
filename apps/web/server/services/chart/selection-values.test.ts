import { PGlite } from "@electric-sql/pglite";
import { createMiddleware } from "hono/factory";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ChartSpec, ItemMeta } from "../../api/types";
import {
  type ChartItem,
  createChart,
  getChart,
} from "../../charts/chart-store";
import { schemaOf } from "../../data/dataset-schema";
import { type ItemRowsScope, querySelectionValues } from "../../data/item-rows";
import { createDb, type Db } from "../../db/database";
import type { ChartOptionsPatch } from "../../render/options";
import type { Region } from "../../render/region";
import type { ServiceEnv } from "../common/http";

// POST …/selection-values: chart 서비스 API → 데이터 표와 같은 행 범위 → 실제 PGlite 조회.
// DB Worker 자리는 같은 함수를 직접 부르는 가짜로 두고, 차트·item 상태는 그린 뒤의 모양으로 직접 만든다.

const dbCall = vi.fn();
vi.mock("../../runtime", () => ({
  getRuntime: () => ({ db: { call: dbCall }, render: { size: 1 } }),
}));
vi.mock("../../png-store", () => ({
  putPng: async () => {},
  deletePngs: async () => {},
  matchPng: async () => undefined,
}));
vi.mock("../../history/recorder", () => ({
  attachHistory: async () => {},
  recordEvent: () => {},
  saveHistory: async () => {},
}));
// 토큰 검증 대신 사용자 한 명으로 통과시킨다.
vi.mock("../common/auth", async (original) => ({
  ...(await original<typeof import("../common/auth")>()),
  requireAuth: () =>
    createMiddleware<ServiceEnv>(async (c, next) => {
      c.set("principal", { sub: "u1", name: "u1", scopes: [] });
      await next();
    }),
}));

const schema = schemaOf([
  { name: "machine", type: "categorical", label: "설비", nullable: false },
  { name: "lot", type: "categorical", label: "lot", nullable: true },
  { name: "x", type: "numeric", label: "x", nullable: false },
  { name: "value", type: "numeric", label: "값", nullable: false },
  { name: "ts", type: "datetime", label: "시각", nullable: false },
]);
const columns = schema.columns.map((c) => ({ ...c, distinct: null }));

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // 저장 순서: 4번째 행은 1번째 행과 설비·lot이 같다. 5번째 행은 lot이 없다.
  await pglite.exec(`
    create table t (machine text, lot text, x float8, value float8, ts timestamptz);
    insert into t values
      ('m1', 'L1', 0, 1, '2026-01-01T00:00:00Z'),
      ('m1', 'L2', 1, 2, '2026-01-01T00:00:01.5Z'),
      ('m2', 'L1', 2, 3, '2026-01-01T00:00:02Z'),
      ('m1', 'L1', 3, 4, '2026-01-01T00:00:03Z'),
      ('m3', null, 4, 5, '2026-01-01T00:00:04Z');
  `);
  dbCall.mockImplementation(
    async (method: string, params: Record<string, unknown>) => {
      if (method !== "selectionValues")
        throw new Error(`unexpected db call ${method}`);
      return querySelectionValues(
        db,
        "t",
        schema,
        params.scope as ItemRowsScope,
        params as never,
      );
    },
  );
}, 30_000);

const { chartApp } = await import("./app");

const spec = (over: Partial<ChartSpec>): ChartSpec => ({
  dataset: "ds",
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

const selectionOf = (selection: ChartOptionsPatch["selection"]) => ({
  color: "#2a78d6",
  options: { selection },
});

/** 다 그린 차트 하나와 item 하나 (선택 영역·metadata·개별 속성은 받은 대로) */
function drawn(
  s: ChartSpec,
  item: { selection?: Region; meta?: unknown; options?: ChartOptionsPatch },
) {
  const chart = createChart(s, { width: 400, height: 300 });
  const record: ChartItem = {
    key: "k",
    label: "item",
    values: [],
    version: 1,
    revision: 1,
    image: { url: "/png", width: 400, height: 300 },
    details: new Map(),
    detailJobs: new Map(),
    shapes: [],
    favorites: [],
    legendGroups: [],
    deletions: [],
    selection: item.selection,
    meta: item.meta as ItemMeta | undefined,
    props: item.options ? { options: item.options } : undefined,
  };
  chart.items = [record];
  chart.columns = columns;
  return chart.id;
}

async function values(chartId: string, body: unknown = {}) {
  const res = await chartApp.request(
    `/charts/${chartId}/items/k/selection-values`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return { status: res.status, body: await res.json() };
}

/** x 0..3.5 (1~4번째 행)을 고르는 scatter 선택 */
const firstFour: Region = { type: "rect", x0: 0, y0: -100, x1: 3.5, y1: 100 };
const everything: Region = {
  type: "rect",
  x0: -1e9,
  y0: -1e9,
  x1: 1e9,
  y1: 1e9,
};

describe("POST …/selection-values", () => {
  it("scatter: 선택 영역 안의 행마다 필드 값을 이어, 처음 나온 순서로 겹치지 않게", async () => {
    const id = drawn(
      spec({ common: selectionOf({ fields: ["machine", "lot"] }) }),
      { selection: firstFour },
    );
    expect(await values(id)).toEqual({
      status: 200,
      body: {
        values: ["m1-L1", "m1-L2", "m2-L1"],
        total: 3,
        truncated: false,
        count: 4,
      },
    });
  });

  it("separator를 쓰고, null은 빈 문자열이다", async () => {
    const id = drawn(
      spec({
        common: selectionOf({ fields: ["lot", "machine"], separator: " / " }),
      }),
      { selection: everything },
    );
    const { body } = await values(id);
    expect(body.values).toEqual(["L1 / m1", "L2 / m1", "L1 / m2", " / m3"]);
    expect(body.count).toBe(5);
  });

  it("숫자는 글자 그대로, 시각은 ISO 8601(UTC)이다", async () => {
    const id = drawn(
      spec({
        common: selectionOf({ fields: ["value", "ts"], separator: "|" }),
      }),
      { selection: { type: "rect", x0: 0.5, y0: -100, x1: 1.5, y1: 100 } },
    );
    expect((await values(id)).body.values).toEqual([
      "2|2026-01-01T00:00:01.500Z",
    ]);
  });

  it("limit에서 자르면 truncated이고, total은 자르기 전 수다", async () => {
    const id = drawn(spec({ common: selectionOf({ fields: ["machine"] }) }), {
      selection: everything,
    });
    expect((await values(id, { limit: 2 })).body).toEqual({
      values: ["m1", "m2"],
      total: 3,
      truncated: true,
      count: 5,
    });
    expect((await values(id, { limit: 1001 })).status).toBe(400);
    expect((await values(id, { limit: 0 })).status).toBe(400);
  });

  it("fields가 비면 값 없이 선택된 행 수만", async () => {
    const id = drawn(spec({}), { selection: firstFour });
    expect((await values(id)).body).toEqual({
      values: [],
      total: 0,
      truncated: false,
      count: 4,
    });
  });

  it("선택 영역이 없으면 빈 결과", async () => {
    const id = drawn(
      spec({ common: selectionOf({ fields: ["machine"] }) }),
      {},
    );
    expect((await values(id)).body).toEqual({
      values: [],
      total: 0,
      truncated: false,
      count: 0,
    });
  });

  it("item 개별 속성의 fields가 공통 속성보다 앞선다", async () => {
    const id = drawn(spec({ common: selectionOf({ fields: ["machine"] }) }), {
      selection: firstFour,
      options: { selection: { fields: ["lot"] } },
    });
    expect((await values(id)).body.values).toEqual(["L1", "L2"]);
  });

  it("line도 선택 영역 안의 점(행)을 쓴다", async () => {
    const id = drawn(
      spec({
        chartType: "line",
        common: selectionOf({ fields: ["machine"] }),
      }),
      { selection: { type: "rect", x0: 1.5, y0: -100, x1: 4.5, y1: 100 } },
    );
    expect((await values(id)).body.values).toEqual(["m2", "m1", "m3"]);
  });

  it("bar·boxplot: 선택 영역 안 막대(상자)의 범주 행", async () => {
    // 범주 m1·m2·m3 막대 하나씩. 막대의 대표 좌표는 [범주 번호, 값]이다.
    const meta = (chartType: "bar" | "boxplot") => ({
      chartType,
      categories: ["m1", "m2", "m3"],
      groupCount: 1,
      ...(chartType === "bar"
        ? { bars: [[7], [3], [5]] }
        : { boxes: [[{ median: 2 }], [{ median: 3 }], [{ median: 5 }]] }),
    });
    for (const chartType of ["bar", "boxplot"] as const) {
      const id = drawn(
        spec({
          chartType,
          x: "machine",
          common: selectionOf({ fields: ["lot"] }),
        }),
        {
          selection: { type: "rect", x0: -0.4, y0: 0, x1: 0.4, y1: 100 },
          meta: meta(chartType),
        },
      );
      expect((await values(id)).body).toMatchObject({
        values: ["L1", "L2"],
        count: 3,
      });
    }
  });

  it("histogram: 선택 영역 안 막대의 구간 행", async () => {
    // value 0..5를 2.5 너비 구간 둘로: [1, 2] / [3, 4, 5]
    const id = drawn(
      spec({
        chartType: "histogram",
        x: "value",
        common: selectionOf({ fields: ["machine"] }),
      }),
      {
        selection: { type: "rect", x0: 3, y0: 0, x1: 4.5, y1: 100 },
        meta: {
          chartType: "histogram",
          bins: { lo: 0, step: 2.5, count: 2 },
          counts: [[2], [3]],
          groupCount: 1,
        },
      },
    );
    expect((await values(id)).body).toMatchObject({
      values: ["m2", "m1", "m3"],
      count: 3,
    });
  });

  it("waterfall: 고른 막대의 범주 행, 합계 막대가 들면 모든 행", async () => {
    const meta = {
      chartType: "waterfall",
      categories: ["m1", "m2", "m3"],
      steps: [
        { kind: 0, start: 0, end: 7 },
        { kind: 0, start: 7, end: 10 },
        { kind: 0, start: 10, end: 15 },
        { kind: 2, start: 0, end: 15 },
      ],
    };
    const chart = (selection: Region) =>
      drawn(
        spec({
          chartType: "waterfall",
          x: "machine",
          common: selectionOf({ fields: ["machine", "lot"] }),
        }),
        { selection, meta },
      );
    const second = chart({ type: "rect", x0: 0.5, y0: 9, x1: 1.5, y1: 11 });
    expect((await values(second)).body).toMatchObject({
      values: ["m2-L1"],
      count: 1,
    });
    const total = chart({ type: "rect", x0: 2.5, y0: 0, x1: 3.5, y1: 20 });
    expect((await values(total)).body).toMatchObject({ total: 4, count: 5 });
  });

  it("선택 필드를 쓰지 않는 차트와 분포 line은 409", async () => {
    for (const s of [
      spec({ chartType: "pie", x: "machine" }),
      spec({ chartType: "heatmap", x: "machine", y: "lot", z: "value" }),
      spec({ chartType: "line", subType: "ecdf" }),
    ]) {
      const id = drawn(s, { selection: everything });
      expect((await values(id)).status).toBe(409);
    }
  });

  it("모르는 item은 404, 아직 그리지 않은 item은 409", async () => {
    const res = await chartApp.request(
      "/charts/none/items/k/selection-values",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    expect(res.status).toBe(404);
    const id = drawn(spec({}), {});
    const item = getChart(id)?.items?.[0];
    if (item) item.image = undefined;
    expect((await values(id)).status).toBe(409);
  });
});
