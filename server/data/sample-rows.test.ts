import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { schemaOf } from "./dataset-schema";
import { querySampleRows, SAMPLE_ROWS, samplePercent } from "./sample-rows";

const schema = schemaOf([
  { name: "id", type: "numeric", label: "번호", nullable: false },
  { name: "line", type: "categorical", label: "라인", nullable: false },
]);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  // 10만 행 중 라인 A가 9만, B가 1만
  await db.exec(`
    create table t as
    select g::float8 as id, case when g % 10 = 0 then 'B' else 'A' end as line
    from generate_series(1, 100000) g;
  `);
});

const page = { offset: 0, limit: 50 };

describe("samplePercent", () => {
  it("상한 이하면 샘플링하지 않고, 넘으면 조금 넉넉한 비율로 뽑는다", () => {
    expect(samplePercent(SAMPLE_ROWS)).toBeNull();
    expect(samplePercent(300_000)).toBeCloseTo(11);
    expect(samplePercent(31_000)).toBe(100);
  });
});

describe("querySampleRows", () => {
  it("전체가 상한을 넘으면 최대 30,000행 샘플을 모든 컬럼으로 준다", async () => {
    const res = await querySampleRows(db, "t", schema, undefined, page);
    expect(res.population).toBe(100_000);
    expect(res.sampled).toBe(true);
    expect(res.total).toBe(SAMPLE_ROWS);
    expect(res.columns.map((c) => c.name)).toEqual(["id", "line"]);
    expect(res.rows).toHaveLength(50);
  });

  it("seed가 고정이라 다시 열거나 정렬을 바꿔도 같은 샘플이다", async () => {
    const asc = { ...page, sort: { column: "id", desc: false } };
    const desc = { ...page, sort: { column: "id", desc: true } };
    const a = await querySampleRows(db, "t", schema, undefined, asc);
    const b = await querySampleRows(db, "t", schema, undefined, asc);
    expect(a.rows).toEqual(b.rows);
    const last = await querySampleRows(db, "t", schema, undefined, {
      ...asc,
      offset: SAMPLE_ROWS - 1,
      limit: 1,
    });
    const top = await querySampleRows(db, "t", schema, undefined, desc);
    expect(top.rows[0]).toEqual(last.rows[0]);
  });

  it("샘플이 저장 순서 앞쪽에 몰리지 않고 전체에 퍼진다", async () => {
    const res = await querySampleRows(db, "t", schema, undefined, {
      offset: 0,
      limit: 1,
      sort: { column: "id", desc: true },
    });
    // 뒤쪽 10%(id > 90,000)도 샘플에 든다.
    expect(res.rows[0][0] as number).toBeGreaterThan(99_000);
  });

  it("필터를 건 뒤 상한 이하면 샘플링하지 않고 전부 준다", async () => {
    const res = await querySampleRows(
      db,
      "t",
      schema,
      [{ kind: "exclude", column: "line", values: ["A"] }],
      page,
    );
    expect(res.population).toBe(10_000);
    expect(res.sampled).toBe(false);
    expect(res.total).toBe(10_000);
    expect(res.rows.every((r) => r[1] === "B")).toBe(true);
  });
});
