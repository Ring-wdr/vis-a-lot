import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSpec, ItemMeta } from "../api/types";
import {
  type ChartItem,
  type ChartRecord,
  cacheChartData,
  createChart,
} from "../charts/chart-store";
import { itemKeyOf } from "../charts/item-key";
import type { LimitData, LimitDataParams } from "../data/limit-data";
import type { ResolvedLimit } from "../render/control-limit";
import type { LimitLine } from "../render/options";
import { getJob, startDetailJob, startItemJob } from "./job-manager";

// 관리선 값이 DB 조회 → 캐시 → 렌더 입력으로 가는 길만 본다. Worker·PNG 저장·history는 막는다.
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
vi.mock("../history/recorder", () => ({ saveHistory: async () => {} }));
vi.stubGlobal("location", { origin: "http://localhost" });

const style = { color: "#000000", width: 1, style: "solid" } as const;
const meanLine: LimitLine = {
  ...style,
  name: "평균",
  axis: "left",
  kind: "column",
  column: "value",
  fn: "avg",
  type: "none",
  multi: false,
};
const stepLine: LimitLine = {
  ...style,
  name: "계단",
  axis: "left",
  kind: "column",
  column: "value",
  fn: "max",
  type: "usl",
  multi: true,
};
const usl: LimitLine = {
  ...style,
  name: "USL",
  axis: "left",
  kind: "reference",
  value: 50,
  type: "usl",
};

const VALUES = [["A"], ["B"]];

function makeChart(common: LimitLine[]): ChartRecord {
  const spec: ChartSpec = {
    dataset: "ds",
    chartType: "scatter",
    x: "t",
    y: "value",
    agg: "avg",
    legend: null,
    splitBy: ["line"],
    splitSeparator: "_",
    tooltip: [],
    grid: { rows: 1, cols: 2 },
    common: { color: "#4263eb", options: { controlLimit: { lines: common } } },
    filters: [
      {
        kind: "range",
        column: "value",
        min: 0,
        max: 100,
        inverse: false,
        includeNull: false,
      },
    ],
  };
  const chart = createChart(spec, { width: 200, height: 100 });
  chart.columns = [
    { name: "line", label: "line", type: "categorical", distinct: 2 },
    { name: "kind", label: "kind", type: "categorical", distinct: 2 },
    { name: "t", label: "t", type: "numeric", distinct: null },
    { name: "value", label: "value", type: "numeric", distinct: null },
  ];
  chart.items = VALUES.map(
    (values): ChartItem => ({
      key: itemKeyOf(values),
      label: values[0],
      values,
      version: 0,
      revision: 0,
      details: new Map(),
      detailJobs: new Map(),
      shapes: [],
      favorites: [],
      legendGroups: [],
      deletions: [],
    }),
  );
  cacheChartData(chart.id, {
    kind: "scatter",
    groups: VALUES.map((values) => ({ values, start: 0, end: 0 })),
    xs: new Float64Array(),
    ys: new Float64Array(),
    ids: new Float64Array(),
    groupOf: new Map(VALUES.map((v, i) => [itemKeyOf(v), i])),
  });
  return chart;
}

/** 요청마다 A는 1, B는 2. 구간별은 구간 0·3에 값 */
function fakeLimitValues(params: LimitDataParams): LimitData {
  const multi = params.requests.some((r) => r.multi);
  return {
    ...(multi
      ? { buckets: params.buckets ?? { lo: 0, hi: 24, count: 240 } }
      : {}),
    groups: VALUES.map((values, i) => ({
      values,
      results: params.requests.map((r) =>
        r.multi
          ? [
              [0, 10 + i],
              [3, 20 + i],
            ]
          : i + 1,
      ),
    })),
  };
}

const meta = {
  x: { domain: [0, 1] },
  y: { domain: [0, 1] },
} as unknown as ItemMeta;

async function finished(jobId: string) {
  for (let i = 0; i < 100; i++) {
    const job = getJob(jobId);
    if (job && ["success", "failed", "cancelled"].includes(job.status))
      return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not finish");
}

const limitsOf = (call: unknown[]) =>
  (call[1] as { limits?: ResolvedLimit[] }).limits;

beforeEach(() => {
  dbCall.mockReset();
  renderCall.mockReset();
  dbCall.mockImplementation(async (op: string, params: LimitDataParams) => {
    if (op !== "limitValues") throw new Error(`unexpected ${op}`);
    return fakeLimitValues(params);
  });
  renderCall.mockImplementation(async () => ({
    png: new ArrayBuffer(1),
    meta,
  }));
});

describe("관리선 값을 렌더 입력에 싣는다", () => {
  it("item마다 집계 값을 채우고, 같은 요청은 다시 조회하지 않는다", async () => {
    const chart = makeChart([usl, meanLine]);
    const keys = (chart.items ?? []).map((i) => i.key);
    expect((await finished(startItemJob(chart, keys).id)).status).toBe(
      "success",
    );
    expect(dbCall).toHaveBeenCalledTimes(1);
    expect(dbCall.mock.calls[0][1]).toMatchObject({
      dataset: "ds",
      x: "t",
      splitBy: ["line"],
      filters: chart.spec.filters,
      requests: [{ column: "value", fn: "avg", multi: false }],
    });
    const [a, b] = renderCall.mock.calls.map(limitsOf);
    expect(a?.map((l) => l.multi === false && l.value)).toEqual([50, 1]);
    expect(b?.map((l) => l.multi === false && l.value)).toEqual([50, 2]);

    // resize·크게 보기도 같은 값을 싣고 다시 조회하지 않는다.
    await finished(startItemJob(chart, keys, { content: false }).id);
    const item = (chart.items ?? [])[0];
    await finished(startDetailJob(chart, item, { width: 400, height: 300 }).id);
    expect(dbCall).toHaveBeenCalledTimes(1);
    expect(renderCall.mock.calls.map(limitsOf).at(-1)).toEqual(a);
  });

  it("item 속성의 새 선만 조회하고, 구간별은 처음 정한 구간을 다시 쓴다", async () => {
    const chart = makeChart([stepLine]);
    const [first, second] = chart.items ?? [];
    await finished(startItemJob(chart, [first.key]).id);
    expect(dbCall).toHaveBeenCalledTimes(1);
    const steps = limitsOf(renderCall.mock.calls[0]);
    expect(steps).toEqual([
      expect.objectContaining({
        multi: true,
        steps: [
          [0, 0.1, 10],
          [0.30000000000000004, 0.4, 20],
        ],
      }),
    ]);

    second.props = {
      options: {
        controlLimit: {
          lines: [{ ...stepLine, fn: "min" }, { ...meanLine }],
        },
      },
    };
    await finished(startItemJob(chart, [second.key]).id);
    expect(dbCall).toHaveBeenCalledTimes(2);
    const params = dbCall.mock.calls[1][1] as LimitDataParams;
    expect(params.requests).toEqual([
      { column: "value", fn: "min", multi: true },
      { column: "value", fn: "avg", multi: false },
    ]);
    expect(params.buckets).toEqual({ lo: 0, hi: 24, count: 240 });
    expect(limitsOf(renderCall.mock.calls[1])?.map((l) => l.name)).toEqual([
      "계단",
      "평균",
    ]);
  });

  it("복원한 item 속성의 맞지 않는 선은 빼고 나머지를 그린다", async () => {
    const chart = makeChart([]);
    const [item] = chart.items ?? [];
    item.props = {
      options: {
        controlLimit: {
          lines: [
            usl,
            { ...meanLine, name: "없는 컬럼", column: "gone" },
            { ...meanLine, name: "범주", column: "kind" },
            { ...usl, name: "두 번째 USL", value: 60 },
            { ...usl, name: "USL", type: "none", value: 70 },
            meanLine,
          ],
        },
      },
    };
    await finished(startItemJob(chart, [item.key]).id);
    expect(dbCall).toHaveBeenCalledTimes(1);
    expect(
      (dbCall.mock.calls[0][1] as LimitDataParams).requests.map(
        (r) => r.column,
      ),
    ).toEqual(["value"]);
    expect(limitsOf(renderCall.mock.calls[0])?.map((l) => l.name)).toEqual([
      "USL",
      "평균",
    ]);
  });

  it("값을 못 구한 선은 빼고, 구역을 끈 차트는 limits를 싣지 않는다", async () => {
    const chart = makeChart([meanLine]);
    dbCall.mockImplementation(async () => ({ groups: [] }));
    const [item] = chart.items ?? [];
    await finished(startItemJob(chart, [item.key]).id);
    expect(limitsOf(renderCall.mock.calls[0])).toEqual([]);

    // 분포 line(ECDF)은 구역을 끈다.
    const ecdf = makeChart([meanLine]);
    ecdf.spec = { ...ecdf.spec, chartType: "line", subType: "ecdf" };
    renderCall.mockClear();
    dbCall.mockClear();
    const [e] = ecdf.items ?? [];
    await finished(startItemJob(ecdf, [e.key]).id);
    expect(dbCall).not.toHaveBeenCalled();
    expect(limitsOf(renderCall.mock.calls[0])).toBeUndefined();
  });
});
