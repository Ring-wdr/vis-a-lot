import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { binIndexOf } from "../render/histogram";
import { schemaOf } from "./dataset-schema";
import { binEdges, histogramBins, queryHistogramData } from "./histogram-data";
import { type ItemRowsScope, queryItemRows } from "./item-rows";

describe("histogramBins", () => {
  it("보기 좋은 폭으로 20~40개 근처의 구간을 만든다", () => {
    for (const [min, max] of [
      [0, 100],
      [-3.2, 41.7],
      [0.001, 0.0173],
      [1000, 98_765],
    ]) {
      const bins = histogramBins(min, max);
      expect(bins.count).toBeGreaterThanOrEqual(20);
      expect(bins.count).toBeLessThanOrEqual(40);
      expect(bins.lo).toBeLessThanOrEqual(min);
      expect(bins.lo + bins.step * bins.count).toBeGreaterThanOrEqual(max);
      const mantissa = bins.step / 10 ** Math.floor(Math.log10(bins.step));
      expect([1, 2, 2.5, 5]).toContain(Number(mantissa.toFixed(6)));
    }
  });

  it("끝값이 경계에 맞으면 마지막 구간이 그 값을 포함한다", () => {
    const bins = histogramBins(0, 100);
    expect(bins).toEqual({ lo: 0, step: 5, count: 20 });
    expect(binIndexOf(bins, 100)).toBe(19);
    expect(binIndexOf(bins, 0)).toBe(0);
    expect(binIndexOf(bins, 4.99)).toBe(0);
    expect(binIndexOf(bins, 5)).toBe(1);
    expect(binIndexOf(bins, 101)).toBe(-1);
  });

  it("값이 하나뿐이면 그 값을 가운데 둔 구간 하나", () => {
    expect(histogramBins(7, 7)).toEqual({ lo: 6.5, step: 1, count: 1 });
    expect(binEdges({ lo: 0, step: 0.1, count: 3 })).toEqual([
      0, 0.1, 0.2, 0.3,
    ]);
  });
});

const schema = schemaOf([
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "kind", type: "categorical", label: "종류", nullable: false },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
]);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table t (line text, kind text, value float8);
    insert into t
      select case when i % 2 = 0 then 'A' else 'B' end,
             case when i % 3 = 0 then 'x' else 'y' end,
             i
      from generate_series(0, 100) as i;
    insert into t values ('A', 'x', null);
  `);
}, 30_000);

describe("queryHistogramData", () => {
  it("전체 범위의 같은 구간으로 split·legend별 개수를 센다", async () => {
    const data = await queryHistogramData(db, schema, {
      table: "t",
      x: "value",
      splitBy: ["line"],
      legend: "kind",
    });
    expect(data.bins).toEqual({ lo: 0, step: 5, count: 20 });
    expect(data.legendValues).toEqual(["x", "y"]);
    expect(data.groups.map((g) => g.values)).toEqual([["A"], ["B"]]);
    const total = (g: number) =>
      data.groups[g].counts.flat().reduce((a, b) => a + b, 0);
    // 0..100 중 짝수 51개, 홀수 50개. 값이 없는 행은 세지 않는다.
    expect(total(0)).toBe(51);
    expect(total(1)).toBe(50);
    // A의 첫 구간 [0, 5): 0, 2, 4 → x는 0만 (3의 배수)
    expect(data.groups[0].counts[0]).toEqual([1, 2]);
    // 마지막 구간 [95, 100]은 100을 포함한다: A는 96, 98, 100
    expect(data.groups[0].counts[19].reduce((a, b) => a + b)).toBe(3);
  });

  it("데이터 표는 선택된 구간·legend 값의 행만 고른다", async () => {
    const scope: ItemRowsScope = {
      chartType: "histogram",
      x: "value",
      y: null,
      legend: "kind",
      splitBy: ["line"],
      splitValues: ["A"],
      columns: ["line", "value", "kind"],
      deletions: [],
      selectedBins: {
        bins: { lo: 0, step: 5, count: 20 },
        marks: [
          [0, "y"],
          [19, "x"],
        ],
      },
    };
    const res = await queryItemRows(db, "t", schema, scope, {
      offset: 0,
      limit: 100,
      sort: { column: "value", desc: false },
    });
    // [0,5)의 y: 2, 4 / [95,100]의 x: 96
    expect(res.rows.map((r) => r[1])).toEqual([2, 4, 96]);
  });
});
