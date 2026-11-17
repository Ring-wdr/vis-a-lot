import { PGlite } from "@electric-sql/pglite";
import { createQueryId, PostgresQueryCompiler, sql } from "kysely";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/database";
import { schemaOf } from "./dataset-schema";
import {
  filterSql as build,
  type RowsFilter,
  resolveRowsSources,
} from "./filters";
import { countRows, type ItemRowsScope } from "./item-rows";

const schema = schemaOf([
  { name: "ts", type: "datetime", label: "측정 시각", nullable: false },
  { name: "factory", type: "categorical", label: "공장", nullable: false },
  { name: "value", type: "numeric", label: "측정값", nullable: true },
]);
/** 조건 조각을 ` and (…)` 글자로 컴파일한다. 앞에 파라미터가 first - 1개 있는 것처럼 번호를 민다. */
const filterSql = (filters: Parameters<typeof build>[1], first = 1) => {
  const parts = build(schema, filters).map((p) => sql` and ${p}`);
  const compiled = new PostgresQueryCompiler().compileQuery(
    sql.join(parts, sql``).toOperationNode(),
    createQueryId(),
  );
  return {
    sql: compiled.sql.replace(
      /\$(\d+)/g,
      (_, i) => `$${Number(i) + first - 1}`,
    ),
    params: [...compiled.parameters],
  };
};

describe("filterSql", () => {
  it("필터가 없으면 빈 조건", () => {
    expect(filterSql([])).toEqual({ sql: "", params: [] });
    expect(filterSql(undefined)).toEqual({ sql: "", params: [] });
  });

  it("숫자 범위, null 포함", () => {
    const { sql, params } = filterSql([
      {
        kind: "range",
        column: "value",
        min: 1,
        max: 5,
        inverse: false,
        includeNull: true,
      },
    ]);
    expect(sql).toBe(
      ' and (("value" >= $1::float8 and "value" <= $2::float8) or "value" is null)',
    );
    expect(params).toEqual([1, 5]);
  });

  it("범위 반전, null 제외, 시계열은 epoch ms로 비교, 파라미터 번호 이어 쓰기", () => {
    const E = `(round(date_part('epoch', "ts") * 1000000) / 1000)`;
    const { sql, params } = filterSql(
      [
        {
          kind: "range",
          column: "ts",
          min: 10,
          max: 20,
          inverse: true,
          includeNull: false,
        },
      ],
      3,
    );
    expect(sql).toBe(` and (${E} < $3::float8 or ${E} > $4::float8)`);
    expect(params).toEqual([10, 20]);
  });

  it("범주 제외는 값 목록을 JSON 파라미터 하나로 넘긴다", () => {
    const { sql, params } = filterSql([
      { kind: "exclude", column: "factory", values: ["구미", "울산"] },
    ]);
    expect(sql).toContain(
      'not ("factory"::text in (select jsonb_array_elements_text($1::jsonb)))',
    );
    expect(params).toEqual(['["구미","울산"]']);
  });

  it("스키마에 없는 컬럼이면 던진다", () => {
    expect(() =>
      filterSql([{ kind: "exclude", column: "nope", values: ["1"] }]),
    ).toThrow("없습니다");
  });

  it("타입이 맞지 않으면 던진다", () => {
    expect(() =>
      filterSql([{ kind: "exclude", column: "value", values: ["1"] }]),
    ).toThrow();
    expect(() =>
      filterSql([
        {
          kind: "range",
          column: "factory",
          min: 0,
          max: 1,
          inverse: false,
          includeNull: true,
        },
      ]),
    ).toThrow();
  });
});

// ── 행 범위 (칸 연결) ─────────────────────────────────────────

/** scatter item 하나의 선택 영역 범위 */
const scatterScope = (
  x: string,
  y: string,
  box: [number, number, number, number],
): ItemRowsScope => ({
  chartType: "scatter",
  x,
  y,
  legend: null,
  splitBy: [],
  splitValues: [],
  columns: [x, y],
  deletions: [],
  selection: { type: "rect", x0: box[0], y0: box[1], x1: box[2], y1: box[3] },
});

describe("filterSql 행 범위", () => {
  it("같은 데이터셋: 따를 칸의 행 조건(선택 영역·draw 필터)을 그대로 건다", () => {
    const { sql, params } = filterSql([
      {
        kind: "rows",
        scope: {
          ...scatterScope("value", "value", [1, 1, 5, 5]),
          filters: [{ kind: "exclude", column: "factory", values: ["구미"] }],
        },
      },
    ]);
    expect(sql).toBe(
      ' and (true and "value" is not null and "value" is not null' +
        ' and point("value"::float8, "value"::float8) <@ $1::box' +
        ' and not ("factory"::text in (select jsonb_array_elements_text($2::jsonb))))',
    );
    expect(params).toEqual(["((1,1),(5,5))", '["구미"]']);
  });

  it("다른 데이터셋은 source 테이블을 채우기 전이면 던진다", () => {
    expect(() =>
      filterSql([
        {
          kind: "rows",
          scope: scatterScope("value", "value", [1, 1, 5, 5]),
          join: { dataset: "other", source: "factory", target: "factory" },
        },
      ]),
    ).toThrow("not resolved");
  });

  it("이 차트 쪽 연결 컬럼이 스키마에 없으면 던진다", () => {
    expect(() =>
      filterSql([
        {
          kind: "rows",
          scope: scatterScope("value", "value", [1, 1, 5, 5]),
          join: { dataset: "other", source: "factory", target: "nope" },
          from: { table: "other", schema },
        },
      ]),
    ).toThrow("없습니다");
  });

  describe("PGlite에서 (공백·한글 컬럼 이름)", () => {
    // source: "설비 번호"·"측정 값", target: "machine id"·"값"
    const source = schemaOf([
      { name: "설비 번호", type: "categorical", label: "설비", nullable: true },
      { name: "측정 값", type: "numeric", label: "측정", nullable: false },
    ]);
    const target = schemaOf([
      {
        name: "machine id",
        type: "categorical",
        label: "설비",
        nullable: true,
      },
      { name: "값", type: "numeric", label: "값", nullable: false },
    ]);
    let db: Db;
    beforeAll(async () => {
      const pglite = new PGlite();
      db = createDb(pglite);
      await pglite.exec(`
        create table "source 표" ("설비 번호" text, "측정 값" float8);
        insert into "source 표" values ('m1', 1), ('m2', 2), ('m3', 30), (null, 3);
        create table "대상" ("machine id" text, "값" float8);
        insert into "대상" values ('m1', 10), ('m1', 11), ('m2', 12), ('m3', 13), ('m4', 14), (null, 15);
      `);
    }, 30_000);

    const lookup = async (dataset: string) => {
      if (dataset !== "src") throw new Error(`unknown ${dataset}`);
      return { table: "source 표", schema: source };
    };
    /** source에서 측정 값 0..5를 고른 범위 → target의 설비 번호로 잇는다 */
    const rows: RowsFilter = {
      kind: "rows",
      scope: scatterScope("측정 값", "측정 값", [0, 0, 5, 5]),
      join: { dataset: "src", source: "설비 번호", target: "machine id" },
    };

    it("연결 컬럼 값(글자)으로 잇는다. null 값은 잇지 않는다", async () => {
      const resolved = await resolveRowsSources([rows], lookup);
      // 선택 안 source 행의 설비: m1, m2, (null) → 대상의 m1 두 행 + m2 한 행
      expect(await countRows(db, "대상", target, resolved ?? [])).toBe(3);
    });

    it("같은 데이터셋이면 source 조건을 그대로 건다", async () => {
      const same: RowsFilter = {
        kind: "rows",
        scope: scatterScope("측정 값", "측정 값", [0, 0, 5, 5]),
      };
      expect(await countRows(db, "source 표", source, [same])).toBe(3);
    });

    it("행 범위가 없거나 이미 채웠으면 같은 배열을 돌려준다", async () => {
      const plain = [
        { kind: "exclude", column: "x", values: [] },
      ] satisfies RowsFilter["scope"]["filters"];
      expect(await resolveRowsSources(plain, lookup)).toBe(plain);
      expect(await resolveRowsSources(undefined, lookup)).toBeUndefined();
      const resolved = await resolveRowsSources([rows], lookup);
      expect(await resolveRowsSources(resolved, lookup)).toBe(resolved);
    });
  });
});
