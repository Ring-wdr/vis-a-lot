import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { schemaOf } from "./dataset-schema";
import { exportItemRows, type ItemRowsScope, queryItemRows } from "./item-rows";

const schema = schemaOf([
  { name: "ts", type: "datetime", label: "측정 시각", nullable: false },
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "kind", type: "categorical", label: "종류", nullable: false },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
]);

let db: Db;
beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  await pglite.exec(`
    create table t (ts timestamptz, line text, kind text, value float8);
    insert into t values
      ('2026-01-01T00:00:00Z', 'A', 'x', 1),
      ('2026-01-01T00:00:01Z', 'A', 'y', 2),
      ('2026-01-01T00:00:02Z', 'A', 'x', 3),
      ('2026-01-01T00:00:03Z', 'B', 'x', 4),
      ('2026-01-01T00:00:04Z', 'A', 'x', null);
  `);
});

const t0 = Date.parse("2026-01-01T00:00:00Z");
const scatter = (patch: Partial<ItemRowsScope> = {}): ItemRowsScope => ({
  chartType: "scatter",
  x: "ts",
  y: "value",
  legend: "kind",
  splitBy: ["line"],
  splitValues: ["A"],
  columns: ["line", "ts", "value", "kind"],
  deletions: [],
  ...patch,
});
const page = { offset: 0, limit: 100 };

describe("queryItemRows", () => {
  it("split 조합과 y 값이 있는 행만, 시각은 epoch ms로", async () => {
    const res = await queryItemRows(db, "t", schema, scatter(), page);
    expect(res.total).toBe(3);
    expect(res.columns.map((c) => c.label)).toEqual([
      "라인",
      "측정 시각",
      "측정값",
      "종류",
    ]);
    expect(res.rows[0]).toEqual(["A", t0, 1, "x"]);
  });

  it("선택 영역 안, 지운 영역 밖, 끈 legend 값 제외", async () => {
    const res = await queryItemRows(
      db,
      "t",
      schema,
      scatter({
        selection: { type: "rect", x0: t0, y0: 0, x1: t0 + 2500, y1: 10 },
        deletions: [
          {
            type: "lasso",
            points: [
              [t0 + 1500, 2.5],
              [t0 + 2500, 2.5],
              [t0 + 2500, 3.5],
              [t0 + 1500, 3.5],
            ],
          },
        ],
        hiddenLegend: ["y"],
      }),
      page,
    );
    expect(res.rows.map((r) => r[2])).toEqual([1]);
  });

  it("열 기준 정렬", async () => {
    const res = await queryItemRows(db, "t", schema, scatter(), {
      ...page,
      sort: { column: "value", desc: true },
    });
    expect(res.rows.map((r) => r[2])).toEqual([3, 2, 1]);
  });

  it("bar: 고른 범주·legend 값 조합만", async () => {
    const res = await queryItemRows(
      db,
      "t",
      schema,
      scatter({
        chartType: "bar",
        x: "kind",
        legend: null,
        selectedMarks: [["y", null]],
      }),
      page,
    );
    expect(res.rows.map((r) => r[2])).toEqual([2]);
  });
});

describe("exportItemRows", () => {
  it("라벨 머리글의 CSV", async () => {
    const blob = await exportItemRows(
      db,
      "t",
      schema,
      scatter({ hiddenLegend: ["y"] }),
    );
    const lines = (await blob.text()).trim().split("\n");
    expect(lines[0]).toBe("라인,측정 시각,측정값,종류");
    expect(lines).toHaveLength(3);
  });
});

describe("선택 필드가 아닌 차트의 item 행", () => {
  it("split·필터가 없어 조건이 하나도 없어도 모든 행을 준다", async () => {
    const scope: ItemRowsScope = {
      chartType: "pie",
      x: "line",
      y: null,
      legend: null,
      splitBy: [],
      splitValues: [],
      columns: ["line", "value"],
      deletions: [],
    };
    const page = await queryItemRows(db, "t", schema, scope, {
      offset: 0,
      limit: 10,
    });
    expect(page.total).toBe(5);
    const csv = await (await exportItemRows(db, "t", schema, scope)).text();
    expect(csv.trim().split("\n")).toHaveLength(6);
  });

  it("split 조합과 draw 시점 필터만으로 모든 컬럼을 준다", async () => {
    const page = await queryItemRows(
      db,
      "t",
      schema,
      {
        chartType: "sankey",
        x: "line",
        y: null,
        legend: null,
        splitBy: ["line"],
        splitValues: ["A"],
        columns: ["ts", "line", "kind", "value"],
        filters: [{ kind: "exclude", column: "kind", values: ["y"] }],
        deletions: [],
      },
      { offset: 0, limit: 10 },
    );
    expect(page.columns.map((c) => c.name)).toEqual([
      "ts",
      "line",
      "kind",
      "value",
    ]);
    // 값이 null인 행도 원본 행이라 남는다.
    expect(page.rows.map((r) => r[3])).toEqual([1, 3, null]);
    expect(page.total).toBe(3);
  });
});
