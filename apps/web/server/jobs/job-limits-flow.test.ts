import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ChartSpec } from "../api/types";
import {
  type ChartItem,
  cacheChartData,
  createChart,
} from "../charts/chart-store";
import { itemKeyOf } from "../charts/item-key";
import { schemaOf } from "../data/dataset-schema";
import { type LimitDataParams, queryLimitData } from "../data/limit-data";
import { createDb, type Db } from "../db/database";
import type { LimitLine } from "../render/options";
import {
  renderScatter,
  type ScatterInput,
  type ScatterMeta,
} from "../render/scatter";
import { getJob, startItemJob } from "./job-manager";

// 관리선 한 바퀴: 차트 속성(spec) → job의 집계(PGlite) → 렌더 입력 → 렌더러 → metadata.
// 단위들이 계약(ResolvedLimit·LimitsMeta)으로만 만나므로 값의 단위(시계열 epoch ms, 식 적용)를 끝까지 따라가 본다.
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

const schema = schemaOf([
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "at", type: "datetime", label: "시각", nullable: false },
  { name: "value", type: "numeric", label: "값", nullable: false },
  { name: "low", type: "numeric", label: "하한", nullable: false },
]);

/** 2026-01-01 00:00 KST부터 1분마다 10행. value = 1..10, low = 2 */
const START = Date.parse("2026-01-01T00:00:00+09:00");
const MINUTE = 60_000;
const N = 10;

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  await pglite.exec(`
    create table d (line text, at timestamptz, value float8, low float8);
    insert into d
      select 'A', timestamptz '2026-01-01 00:00:00+09' + i * interval '1 minute', i + 1, 2
      from generate_series(0, ${N - 1}) as i;
  `);
}, 30_000);

/** 그리기 호출을 버리는 canvas (글자 폭만 어림한다) */
function nullCtx() {
  const state: Record<string, unknown> = {
    canvas: { width: 400, height: 300 },
  };
  return new Proxy(state, {
    get: (target, key: string) => {
      if (key === "measureText")
        return (text: string) => ({ width: text.length * 6 });
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
}

const style = { color: "#e03131", width: 1, style: "solid" } as const;
const lines: LimitLine[] = [
  // 기준선은 축 눈금을 보고 적은 값이라 식을 적용하지 않는다.
  {
    ...style,
    name: "USL",
    axis: "left",
    kind: "reference",
    value: 13,
    type: "usl",
  },
  // 컬럼 선은 식(y * 2)을 적용한다: avg(low) = 2 → 4
  {
    ...style,
    name: "LSL",
    axis: "left",
    kind: "column",
    column: "low",
    fn: "avg",
    type: "lsl",
    multi: false,
  },
  // 시계열 Bottom 기준선은 화면이 저장한 KST ISO 시각
  {
    ...style,
    name: "교대",
    axis: "bottom",
    kind: "reference",
    value: "2026-01-01T00:05:00+09:00",
    type: "none",
  },
  // 구간별 최대: 경계는 epoch ms, 값은 식을 적용한다
  {
    ...style,
    name: "계단",
    axis: "left",
    kind: "column",
    column: "value",
    fn: "max",
    type: "none",
    multi: true,
  },
];

describe("관리선 spec → job → 렌더 → metadata", () => {
  it("시계열 x·식·구간별 선이 그린 좌표로 metadata에 나오고 이탈을 센다", async () => {
    dbCall.mockImplementation(
      async (
        op: string,
        { dataset: _, ...params }: LimitDataParams & { dataset: string },
      ) => {
        if (op !== "limitValues") throw new Error(`unexpected ${op}`);
        return queryLimitData(db, schema, { ...params, table: "d" });
      },
    );
    let meta: ScatterMeta | undefined;
    renderCall.mockImplementation(async (_op: string, input: ScatterInput) => {
      meta = renderScatter(nullCtx(), input, () => {});
      return { png: new ArrayBuffer(1), meta };
    });

    const spec: ChartSpec = {
      dataset: "ds",
      chartType: "scatter",
      x: "at",
      y: "value",
      agg: "avg",
      legend: null,
      splitBy: ["line"],
      splitSeparator: "_",
      tooltip: [],
      grid: { rows: 1, cols: 1 },
      common: {
        color: "#4263eb",
        options: { controlLimit: { lines }, expression: { x: "", y: "y * 2" } },
      },
    };
    const chart = createChart(spec, { width: 400, height: 300 });
    chart.columns = [
      { name: "line", label: "라인", type: "categorical", distinct: 1 },
      { name: "at", label: "시각", type: "datetime", distinct: null },
      { name: "value", label: "값", type: "numeric", distinct: null },
      { name: "low", label: "하한", type: "numeric", distinct: null },
    ];
    const item: ChartItem = {
      key: itemKeyOf(["A"]),
      label: "A",
      values: ["A"],
      version: 0,
      revision: 0,
      details: new Map(),
      detailJobs: new Map(),
      shapes: [],
      favorites: [],
      legendGroups: [],
      deletions: [],
    };
    chart.items = [item];
    const xs = Float64Array.from({ length: N }, (_, i) => START + i * MINUTE);
    cacheChartData(chart.id, {
      kind: "scatter",
      groups: [{ values: ["A"], start: 0, end: N }],
      xs,
      ys: Float64Array.from({ length: N }, (_, i) => i + 1),
      ids: Float64Array.from({ length: N }, (_, i) => i),
      groupOf: new Map([[item.key, 0]]),
    });

    const job = startItemJob(chart, [item.key]);
    const done = () =>
      ["success", "failed", "cancelled"].includes(getJob(job.id)?.status ?? "");
    for (let i = 0; i < 200 && !done(); i++)
      await new Promise((r) => setTimeout(r, 5));
    expect(getJob(job.id)?.status).toBe("success");

    // 렌더 입력: 식을 적용하지 않은 데이터 값, 시계열 기준선은 epoch ms
    const input = renderCall.mock.calls[0][1] as ScatterInput;
    expect(input.xKind).toBe("time");
    expect(input.limits?.map((l) => l.name)).toEqual([
      "USL",
      "LSL",
      "교대",
      "계단",
    ]);
    expect(input.limits?.[2]).toMatchObject({
      multi: false,
      value: START + 5 * MINUTE,
    });

    // metadata: 그린 좌표 (y 식 적용, 기준선은 그대로)
    const limits = meta?.limits;
    expect(limits?.lines.slice(0, 3)).toEqual([
      { name: "USL", axis: "left", type: "usl", value: 13 },
      { name: "LSL", axis: "left", type: "lsl", value: 4 },
      { name: "교대", axis: "bottom", type: "none", value: START + 5 * MINUTE },
    ]);
    const steps = limits?.lines[3].steps ?? [];
    // 행마다 구간 하나: 첫 구간은 첫 시각에서, 마지막 구간은 끝 시각에서 끝난다
    expect(steps).toHaveLength(N);
    expect(steps[0][0]).toBe(START);
    expect(steps.at(-1)?.[1]).toBe(START + (N - 1) * MINUTE);
    expect(steps.map((s) => s[2])).toEqual(
      Array.from({ length: N }, (_, i) => (i + 1) * 2),
    );
    // y = 2..20: 4보다 작은 2, 13보다 큰 14·16·18·20
    expect(limits?.out).toBe(5);
    // fitAxis: 기준선 시각이 x 축 범위 안에 있다
    const [x0, x1] = meta?.x.domain ?? [0, 0];
    expect(x0 <= START + 5 * MINUTE && START + 5 * MINUTE <= x1).toBe(true);
  });
});
