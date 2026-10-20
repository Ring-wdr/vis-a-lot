import { describe, expect, it } from "vitest";
import { filterSql } from "./filters";

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
      " and ((value >= $1::float8 and value <= $2::float8) or value is null)",
    );
    expect(params).toEqual([1, 5]);
  });

  it("범위 반전, null 제외, 시계열은 epoch ms로 비교, 파라미터 번호 이어 쓰기", () => {
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
    expect(sql).toBe(
      " and ((extract(epoch from ts) * 1000) < $3::float8 or (extract(epoch from ts) * 1000) > $4::float8)",
    );
    expect(params).toEqual([10, 20]);
  });

  it("범주 제외는 값 목록을 JSON 파라미터 하나로 넘긴다", () => {
    const { sql, params } = filterSql([
      { kind: "exclude", column: "factory", values: ["구미", "울산"] },
    ]);
    expect(sql).toContain(
      "not (factory::text in (select jsonb_array_elements_text($1::jsonb)))",
    );
    expect(params).toEqual(['["구미","울산"]']);
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
