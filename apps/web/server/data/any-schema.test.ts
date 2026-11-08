// 컬럼 이름·타입이 IoT 생성기와 전혀 다른 raw data에서도 스키마만으로 동작하는지 본다.
// 실제 PGlite(WASM Postgres)를 Node에서 띄운다.

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { queryBarData } from "./category-data";
import {
  queryChartData,
  queryLegendValues,
  queryRowValues,
} from "./chart-data";
import { queryColumnSummary } from "./column-summary";
import { type DatasetSchema, readTableSchema } from "./dataset-schema";

const TABLE = "plant_raw";
let db: Db;
let schema: DatasetSchema;

beforeAll(async () => {
  const pglite = new PGlite();
  db = createDb(pglite);
  await pglite.exec(`
    create table ${TABLE} (
      "측정일시" timestamptz not null,
      "Line No" text not null,
      "불량여부" boolean,
      "온도(℃)" double precision,
      "count" integer,
      "검사일" date
    );
    comment on column ${TABLE}."온도(℃)" is '온도';
    insert into ${TABLE} values
      ('2026-10-01 00:00+00', 'A-1', false, 20.5, 1, '2026-10-01'),
      ('2026-10-01 01:00+00', 'A-1', true,  25.0, 2, '2026-10-01'),
      ('2026-10-01 02:00+00', 'B-2', false, null, 3, '2026-10-02'),
      ('2026-10-01 03:00+00', 'B-2', false, 30.0, 4, '2026-10-02');
  `);
  const read = await readTableSchema(db, TABLE);
  if (!read) throw new Error("schema not found");
  schema = read;
}, 30_000);

describe("스키마만으로 동작", () => {
  it("DB 타입으로 논리 타입을 정하고, 주석이 있으면 라벨로 쓴다", () => {
    expect(
      schema.columns.map((c) => [c.name, c.type, c.label, c.nullable]),
    ).toEqual([
      ["측정일시", "datetime", "측정일시", false],
      ["Line No", "categorical", "Line No", false],
      ["불량여부", "categorical", "불량여부", true],
      ["온도(℃)", "numeric", "온도", true],
      ["count", "numeric", "count", true],
      ["검사일", "datetime", "검사일", true],
    ]);
  });

  it("scatter 조회: 특수문자 컬럼, split, legend, 범위 필터", async () => {
    const data = await queryChartData(db, schema, {
      table: TABLE,
      x: "측정일시",
      y: "온도(℃)",
      splitBy: ["Line No"],
      legend: "불량여부",
      filters: [
        {
          kind: "range",
          column: "온도(℃)",
          min: 21,
          max: 40,
          inverse: false,
          includeNull: false,
        },
      ],
    });
    expect(data.groups.map((g) => g.values)).toEqual([["A-1"], ["B-2"]]);
    expect([...data.ys]).toEqual([25, 30]);
    expect(data.legend?.values).toEqual(["false", "true"]);
  });

  it("bar 집계와 범주 제외 필터", async () => {
    const data = await queryBarData(db, schema, {
      table: TABLE,
      chartType: "bar",
      x: "Line No",
      y: "count",
      agg: "sum",
      splitBy: [],
      legend: null,
      filters: [{ kind: "exclude", column: "Line No", values: ["B-2"] }],
    });
    expect(data.groups[0].categories).toEqual(["A-1"]);
    expect(data.groups[0].bars).toEqual([[3]]);
  });

  it("필터용 요약: 숫자는 범위와 null, 범주는 값별 개수", async () => {
    expect(
      await queryColumnSummary(db, TABLE, schema, "온도(℃)"),
    ).toMatchObject({
      kind: "range",
      type: "numeric",
      min: 20.5,
      max: 30,
      nullCount: 1,
    });
    expect(
      await queryColumnSummary(db, TABLE, schema, "Line No"),
    ).toMatchObject({
      kind: "values",
      values: [
        { value: "A-1", count: 2 },
        { value: "B-2", count: 2 },
      ],
    });
  });

  it("툴팁 값, legend 값", async () => {
    const data = await queryChartData(db, schema, {
      table: TABLE,
      x: "count",
      y: "count",
      splitBy: [],
      legend: null,
    });
    const values = await queryRowValues(db, TABLE, schema, data.ids[0], [
      "Line No",
      "검사일",
    ]);
    expect(values["Line No"]).toBe("A-1");
    expect(typeof values.검사일).toBe("number");
    expect(await queryLegendValues(db, TABLE, schema, "Line No")).toEqual([
      "A-1",
      "B-2",
    ]);
  });

  it("없는 컬럼이나 맞지 않는 타입은 거절한다", async () => {
    await expect(
      queryChartData(db, schema, {
        table: TABLE,
        x: "Line No",
        y: "온도(℃)",
        splitBy: [],
        legend: null,
      }),
    ).rejects.toThrow("쓸 수 없습니다");
    await expect(queryColumnSummary(db, TABLE, schema, "nope")).rejects.toThrow(
      "없습니다",
    );
  });
});
