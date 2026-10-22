import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { schemaOf } from "./dataset-schema";
import { exportItemRows, type ItemRowsScope, queryItemRows } from "./item-rows";

const schema = schemaOf([
  { name: "ts", type: "datetime", label: "측정 시각", nullable: false },
  { name: "line", type: "categorical", label: "라인", nullable: false },
  { name: "kind", type: "categorical", label: "종류", nullable: false },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
]);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
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
