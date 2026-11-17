import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { queryBarData, queryRestAgg, splitKeyOf } from "./category-data";
import { schemaOf } from "./dataset-schema";
import type { AggFn } from "./schema";

const schema = schemaOf([
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "step", type: "categorical", label: "단계", nullable: false },
  { name: "value", type: "numeric", label: "값", nullable: true },
]);

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  // A·a: 1, 2, 2, 3, 7 (빈 값 하나), A·b: 행 하나, B·a: 4, 8
  await pglite.exec(`
    create table t (line text, step text, value float8);
    insert into t values
      ('A', 'a', 1), ('A', 'a', 2), ('A', 'a', 2), ('A', 'a', 3), ('A', 'a', 7), ('A', 'a', null),
      ('A', 'b', 5),
      ('B', 'a', 4), ('B', 'a', 8);
  `);
}, 30_000);

const barsOf = async (agg: AggFn) => {
  const data = await queryBarData(db, schema, {
    table: "t",
    chartType: "bar",
    x: "step",
    y: "value",
    agg,
    splitBy: ["line"],
    legend: null,
  });
  return data.groups.map((g) => g.bars?.map((row) => row[0]));
};

describe("통계 함수", () => {
  it("고유값 수·표준편차·모표준편차·사분위수", async () => {
    expect(await barsOf("uniqueCount")).toEqual([[4, 1], [2]]);
    // 1, 2, 2, 3, 7: 평균 3, 제곱 편차 합 4 + 1 + 1 + 0 + 16 = 22
    const [[sd], [sdB]] = (await barsOf("stddev")) as number[][];
    expect(sd).toBeCloseTo(Math.sqrt(22 / 4));
    expect(sdB).toBeCloseTo(Math.sqrt(8));
    const [[sdp]] = (await barsOf("stddevP")) as number[][];
    expect(sdp).toBeCloseTo(Math.sqrt(22 / 5));
    expect(await barsOf("q1")).toEqual([[2, 5], [5]]);
    expect(await barsOf("q3")).toEqual([[3, 5], [7]]);
  });

  it("행이 하나면 표본 표준편차는 빈 칸(null), 모표준편차는 0", async () => {
    expect((await barsOf("stddev"))[0]?.[1]).toBeNull();
    expect((await barsOf("stddevP"))[0]?.[1]).toBe(0);
  });
});

describe("queryRestAgg", () => {
  it("'기타'로 묶을 범주의 원래 행으로 다시 집계한다", async () => {
    const others = await queryRestAgg(
      db,
      schema,
      { table: "t", x: "step", y: "value", agg: "stddevP", splitBy: ["line"] },
      [{ values: ["A"], rest: ["a", "b"] }],
    );
    // 1, 2, 2, 3, 7, 5: 평균 10/3
    const v = [1, 2, 2, 3, 7, 5];
    const mean = v.reduce((a, b) => a + b) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    expect(others.get(splitKeyOf(["A"]))).toBeCloseTo(sd);
    expect(others.has(splitKeyOf(["B"]))).toBe(false);
  });

  it("묶을 범주가 없으면 조회하지 않는다", async () => {
    const others = await queryRestAgg(
      db,
      schema,
      { table: "t", x: "step", y: "value", agg: "q1", splitBy: [] },
      [],
    );
    expect(others.size).toBe(0);
  });
});
