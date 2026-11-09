import { describe, expect, it } from "vitest";
import type { ChartSpec, ColumnInfo } from "@/shared/api/types";
import { axisColumns, fitSpecToSchema, legendColumns } from "./column-roles";

const col = (
  name: string,
  type: ColumnInfo["type"],
  distinct: number | null = null,
): ColumnInfo => ({ name, label: name, type, nullable: true, distinct });

// IoT와 이름이 전혀 다른 공장 데이터
const plant = [
  col("검사일시", "datetime"),
  col("라인코드", "categorical", 6),
  col("LOT번호", "categorical", 900),
  col("두께", "numeric", 500),
  col("폭", "numeric", 300),
];

const spec: ChartSpec = {
  dataset: "iot-100k",
  chartType: "scatter",
  x: "ts",
  y: "value",
  agg: "avg",
  legend: "factory",
  splitBy: ["factory", "라인코드"],
  splitSeparator: "-",
  tooltip: ["machine"],
  grid: { rows: 3, cols: 3 },
  common: { color: "#2a78d6" },
  filters: [{ kind: "exclude", column: "factory", values: ["구미"] }],
};

describe("column roles", () => {
  it("축 후보와 legend 후보를 타입과 고유값 수로 정한다", () => {
    expect(axisColumns(plant, "scatter").map((c) => c.name)).toEqual([
      "검사일시",
      "두께",
      "폭",
    ]);
    expect(axisColumns(plant, "bar").map((c) => c.name)).toEqual([
      "라인코드",
      "LOT번호",
    ]);
    expect(legendColumns(plant).map((c) => c.name)).toEqual(["라인코드"]);
  });

  it("다른 데이터셋으로 바꾸면 맞지 않는 설정을 기본값으로 바로잡는다", () => {
    expect(fitSpecToSchema(spec, plant)).toEqual({
      x: "검사일시",
      y: "두께",
      legend: null,
      splitBy: ["라인코드"],
      tooltip: [],
      filters: [],
    });
  });

  it("이미 맞으면 바꾸지 않는다", () => {
    const fitted = { ...spec, ...fitSpecToSchema(spec, plant) };
    expect(fitSpecToSchema(fitted, plant)).toBeUndefined();
  });

  it("bar로 바꾸면 x를 범주 컬럼으로", () => {
    const fitted = {
      ...spec,
      ...fitSpecToSchema(spec, plant),
      chartType: "bar" as const,
    };
    expect(fitSpecToSchema(fitted, plant)).toEqual({ x: "라인코드" });
  });
});
