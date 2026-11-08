// 점 차트 데이터(queryChartData)를 split 조합마다 한 행으로 묶어 받는 방식과, 시각 → epoch ms 식(numericSql).
// 실제 PGlite(WASM Postgres)를 Node에서 띄운다.

import { PGlite } from "@electric-sql/pglite";
import { sql } from "kysely";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { queryChartData } from "./chart-data";
import {
  type DatasetSchema,
  numericSql,
  readTableSchema,
} from "./dataset-schema";

const TABLE = "points";
let db: Db;
let schema: DatasetSchema;

beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  await pglite.exec(`
    create table ${TABLE} (ts timestamptz, grp text, kind text, v double precision);
    insert into ${TABLE} values
      ('2026-10-01 00:00:00.123+00', 'a', 'x', 1.5),
      ('2026-10-01 00:00:01.000001+00', 'a', null, -2),
      ('1969-12-31 23:59:59.999999+00', 'b', 'y', 1e300),
      ('2026-10-01 00:00:02+00', null, 'x', 0.1),
      ('2026-10-01 00:00:03+00', 'b', 'y', null);
  `);
  const read = await readTableSchema(db, TABLE);
  if (!read) throw new Error("schema not found");
  schema = read;
}, 30_000);

describe("numericSql", () => {
  it("시각은 extract(epoch) * 1000을 float8로 바꾼 값과 똑같다 (마이크로초·1970년 이전 포함)", async () => {
    const ts = schema.byName.get("ts");
    if (!ts) throw new Error("no ts");
    const res = await sql<{
      a: number;
      b: number;
    }>`select (extract(epoch from ts) * 1000)::float8 as a, ${numericSql(ts)}::float8 as b from ${sql.table(TABLE)}`.execute(
      db,
    );
    for (const row of res.rows) expect(row.b).toBe(row.a);
    expect(res.rows[0].b).toBe(Date.UTC(2026, 9, 1) + 123);
  });
});

describe("queryChartData", () => {
  it("split 조합마다 묶고(값 순, null은 끝), 한 조합 안의 x·y·id·legend가 같은 행끼리 맞는다", async () => {
    const data = await queryChartData(db, schema, {
      table: TABLE,
      x: "ts",
      y: "v",
      splitBy: ["grp"],
      legend: "kind",
    });
    expect(data.groups.map((g) => [g.values, g.end - g.start])).toEqual([
      [["a"], 2],
      [["b"], 1],
      [[null], 1],
    ]);
    // legend 목록은 null도 값 하나로 갖고, 행마다 그 위치를 받는다
    expect(data.legend?.values).toEqual(["x", "y", null]);
    const rows = data.groups.flatMap((g) =>
      Array.from({ length: g.end - g.start }, (_, i) => {
        const at = g.start + i;
        return [
          g.values[0],
          data.ys[at],
          data.legend?.values[data.legend.index[at]],
        ];
      }),
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        ["a", 1.5, "x"],
        ["a", -2, null],
        ["b", 1e300, "y"],
        [null, 0.1, "x"],
      ]),
    );
    expect(new Set(data.ids).size).toBe(4);
  });

  it("split 없이 맞는 행이 없으면 빈 item 하나", async () => {
    const data = await queryChartData(db, schema, {
      table: TABLE,
      x: "ts",
      y: "v",
      splitBy: [],
      legend: null,
      filters: [
        {
          kind: "range",
          column: "v",
          min: 100,
          max: 200,
          inverse: false,
          includeNull: false,
        },
      ],
    });
    expect(data.groups).toEqual([{ values: [], start: 0, end: 0 }]);
    expect(data.xs).toHaveLength(0);
  });
});
