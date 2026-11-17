import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import type { LimitLine } from "../render/options";
import { schemaOf } from "./dataset-schema";
import {
  bucketEdges,
  type LimitData,
  type LimitRequest,
  limitRequestKey,
  queryLimitData,
  resolveLimits,
} from "./limit-data";

const schema = schemaOf([
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "kind", type: "categorical", label: "종류", nullable: false },
  { name: "t", type: "numeric", label: "순번", nullable: true },
  { name: "at", type: "datetime", label: "시각", nullable: true },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
  { name: "usl", type: "numeric", label: "상한", nullable: true },
  { name: "empty", type: "numeric", label: "빈 값", nullable: true },
]);

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // t = 0..239, A는 짝수 t, B는 홀수 t. value = t, usl = t + 10. C는 행이 하나뿐이다.
  await pglite.exec(`
    create table d (line text, kind text, t float8, at timestamptz, value float8, usl float8, empty float8);
    insert into d
      select case when i % 2 = 0 then 'A' else 'B' end,
             case when i % 3 = 0 then 'x' else 'y' end,
             i, timestamptz '2026-01-01 00:00:00+00' + i * interval '1 minute', i, i + 10, null
      from generate_series(0, 239) as i;
    insert into d values ('A', 'x', null, null, 1000, null, null);
  `);
}, 30_000);

const req = (column: string, fn: LimitRequest["fn"], multi = false) => ({
  column,
  fn,
  multi,
});
const byLine = (data: LimitData) =>
  new Map(data.groups.map((g) => [g.values.join("|"), g.results]));

describe("queryLimitData", () => {
  it("split 조합별로 요청한 (컬럼, 함수)를 한 번에 집계한다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: ["line"],
      requests: [
        req("value", "avg"),
        req("value", "max"),
        req("value", "min"),
        req("value", "median"),
        req("empty", "avg"),
      ],
    });
    expect(data.buckets).toBeUndefined();
    const g = byLine(data);
    // A: 0, 2, …, 238 + 1000 (x가 없는 행도 집계한다)
    const a = Array.from({ length: 120 }, (_, i) => i * 2);
    const avgA = (a.reduce((s, v) => s + v, 0) + 1000) / 121;
    expect(g.get("A")?.[0]).toBeCloseTo(avgA, 9);
    expect(g.get("A")?.slice(1, 4)).toEqual([1000, 0, 120]);
    // B: 1, 3, …, 239 → 중앙값은 가운데 두 값의 평균
    expect(g.get("B")?.slice(0, 4)).toEqual([120, 239, 1, 120]);
    // 전부 null인 컬럼은 null
    expect(g.get("A")?.[4]).toBeNull();
  });

  it("필터를 적용하고, 행이 없는 조합은 결과에 없다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: ["line", "kind"],
      filters: [
        {
          kind: "range",
          column: "value",
          min: 0,
          max: 9,
          inverse: false,
          includeNull: false,
        },
        { kind: "exclude", column: "kind", values: ["y"] },
      ],
      requests: [req("value", "max")],
    });
    // 0..9 중 3의 배수: A(0, 6), B(3, 9). kind y는 뺐다.
    expect(data.groups.map((g) => [g.values, g.results[0]])).toEqual([
      [["A", "x"], 6],
      [["B", "x"], 9],
    ]);
  });

  it("split이 없고 맞는 행이 없으면 빈 결과다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: [],
      filters: [
        {
          kind: "range",
          column: "value",
          min: -10,
          max: -5,
          inverse: false,
          includeNull: false,
        },
      ],
      requests: [req("value", "avg"), req("value", "avg", true)],
    });
    expect(data.groups).toEqual([]);
    expect(data.buckets).toBeNull();
  });

  it("구간별은 필터를 건 전체 x 범위의 240구간으로 나눠 모든 조합이 같은 구간을 쓴다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: ["line"],
      requests: [req("value", "avg", true), req("usl", "max", true)],
    });
    expect(data.buckets).toEqual({ lo: 0, hi: 239, count: 240 });
    const g = byLine(data);
    const a = g.get("A")?.[0] as [number, number][];
    const b = g.get("B")?.[0] as [number, number][];
    // 폭이 239/240이라 t = i는 대체로 구간 i에 들고, 끝값 239는 마지막 구간에 든다.
    // A는 짝수 t만 있어 값이 있는 구간만 담는다. x가 없는 행(1000)은 구간별에서 빠진다.
    expect(a.length).toBe(120);
    expect(b.length).toBe(120);
    expect(a.every(([, v]) => v < 1000)).toBe(true);
    expect(b.at(-1)).toEqual([239, 239]);
    expect(a.map(([bucket]) => bucket)).toEqual(
      [...a.map(([bucket]) => bucket)].sort((p, q) => p - q),
    );
    // 두 요청이 같은 구간 번호를 쓴다.
    const usl = new Map(g.get("A")?.[1] as [number, number][]);
    for (const [bucket, v] of a) expect(usl.get(bucket)).toBe(v + 10);
  });

  it("앞서 정한 구간을 주면 그 구간으로 나눈다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: [],
      requests: [req("value", "max", true)],
      buckets: { lo: 0, hi: 240, count: 2 },
    });
    expect(data.buckets).toEqual({ lo: 0, hi: 240, count: 2 });
    expect(data.groups[0].results[0]).toEqual([
      [0, 119],
      [1, 239],
    ]);
  });

  it("시계열 x는 epoch ms로 구간을 정한다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "at",
      splitBy: [],
      requests: [req("value", "min", true)],
    });
    const lo = Date.parse("2026-01-01T00:00:00Z");
    expect(data.buckets).toEqual({ lo, hi: lo + 239 * 60_000, count: 240 });
  });

  it("x 값이 하나뿐이면 구간 하나다", async () => {
    const data = await queryLimitData(db, schema, {
      table: "d",
      x: "t",
      splitBy: [],
      filters: [
        {
          kind: "range",
          column: "t",
          min: 5,
          max: 5,
          inverse: false,
          includeNull: false,
        },
      ],
      requests: [req("value", "avg", true)],
    });
    expect(data.buckets).toEqual({ lo: 5, hi: 5, count: 1 });
    expect(data.groups[0].results[0]).toEqual([[0, 5]]);
  });

  it("범주 컬럼은 집계하지 않는다", async () => {
    await expect(
      queryLimitData(db, schema, {
        table: "d",
        x: "t",
        splitBy: [],
        requests: [req("kind", "avg")],
      }),
    ).rejects.toThrow();
  });
});

describe("bucketEdges", () => {
  it("마지막 구간의 끝은 hi 그대로다", () => {
    const b = { lo: 0, hi: 0.3, count: 3 };
    expect(bucketEdges(b, 0)[0]).toBe(0);
    expect(bucketEdges(b, 2)[1]).toBe(0.3);
  });
});

describe("resolveLimits", () => {
  const style = { color: "#000000", width: 1, style: "solid" } as const;
  const lines: LimitLine[] = [
    {
      ...style,
      name: "USL",
      axis: "left",
      kind: "reference",
      value: 10,
      type: "usl",
    },
    {
      ...style,
      name: "시작",
      axis: "bottom",
      kind: "reference",
      value: "2026-01-01T00:00:00Z",
      type: "none",
    },
    {
      ...style,
      name: "평균",
      axis: "left",
      kind: "column",
      column: "value",
      fn: "avg",
      type: "lsl",
      multi: false,
    },
    {
      ...style,
      name: "띠",
      axis: "left",
      kind: "band",
      column: "value",
      column2: "usl",
      multi: false,
    },
    {
      ...style,
      name: "계단",
      axis: "left",
      kind: "band",
      column: "value",
      column2: "usl",
      multi: true,
    },
    {
      ...style,
      name: "빈 선",
      axis: "left",
      kind: "column",
      column: "empty",
      fn: "avg",
      type: "none",
      multi: false,
    },
  ];
  const values = new Map<string, unknown>([
    [limitRequestKey(req("value", "avg")), 3],
    [limitRequestKey(req("usl", "avg")), 13],
    [limitRequestKey(req("empty", "avg")), null],
    [
      limitRequestKey(req("value", "avg", true)),
      [
        [0, 1],
        [2, 5],
      ],
    ],
    [limitRequestKey(req("usl", "avg", true)), [[2, 15]]],
  ]);

  it("값을 채우고 값을 못 구한 선은 뺀다", () => {
    const out = resolveLimits(
      lines,
      (r) => values.get(limitRequestKey(r)) as never,
      { lo: 0, hi: 30, count: 3 },
      true,
    );
    expect(out.map((l) => l.name)).toEqual([
      "USL",
      "시작",
      "평균",
      "띠",
      "계단",
    ]);
    expect(out[1]).toMatchObject({
      multi: false,
      value: Date.parse("2026-01-01T00:00:00Z"),
    });
    expect(out[2]).toMatchObject({ multi: false, value: 3, type: "lsl" });
    expect(out[3]).toMatchObject({
      multi: false,
      value: 3,
      value2: 13,
      type: "none",
    });
    // 띠 계단은 두 값이 다 있는 구간만
    expect(out[4]).toMatchObject({ multi: true, steps: [[20, 30, 5, 15]] });
  });

  it("구간별 선은 구간이 없으면 뺀다", () => {
    const out = resolveLimits(
      lines.slice(4),
      (r) => values.get(limitRequestKey(r)) as never,
      null,
      false,
    );
    expect(out).toEqual([]);
  });
});
