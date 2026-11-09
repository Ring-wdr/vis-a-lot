import { describe, expect, it } from "vitest";
import type { ChartSpec } from "../api/types";
import { specError } from "./validate-spec";

// 고정 이름이 아닌, 아무 공장의 raw data 같은 컬럼들
const columns = [
  { name: "측정일시", label: "측정일시", type: "datetime", distinct: null },
  { name: "Line No", label: "Line No", type: "categorical", distinct: 4 },
  { name: "lot", label: "lot", type: "categorical", distinct: 500 },
  { name: "온도(℃)", label: "온도", type: "numeric", distinct: 900 },
] as const;

const base: ChartSpec = {
  dataset: "iot-100k",
  chartType: "scatter",
  x: "측정일시",
  y: "온도(℃)",
  agg: "avg",
  legend: null,
  splitBy: [],
  splitSeparator: "-",
  tooltip: [],
  grid: { rows: 1, cols: 1 },
  common: { color: "#2a78d6" },
};

describe("specError", () => {
  it("스키마 타입만 맞으면 이름이 무엇이든 통과한다", () => {
    expect(specError(base, columns)).toBeUndefined();
    expect(
      specError(
        {
          ...base,
          chartType: "bar",
          x: "Line No",
          legend: "Line No",
          splitBy: ["lot"],
        },
        columns,
      ),
    ).toBeUndefined();
  });

  it("없는 컬럼, 타입이 맞지 않는 축", () => {
    expect(specError({ ...base, x: "ts" }, columns)).toContain(
      "데이터에 없습니다",
    );
    expect(specError({ ...base, y: "Line No" }, columns)).toContain("numeric");
    expect(
      specError({ ...base, chartType: "bar", x: "온도(℃)" }, columns),
    ).toContain("categorical");
  });

  it("legend는 범주이고 값이 8개 이하", () => {
    expect(specError({ ...base, legend: "lot" }, columns)).toContain(
      "8개 이하",
    );
    expect(specError({ ...base, legend: "온도(℃)" }, columns)).toContain(
      "categorical",
    );
  });

  it("sankey는 출발·도착이 서로 다른 범주, z는 숫자이고 legend 컬럼은 보지 않는다", () => {
    const sankey: ChartSpec = {
      ...base,
      chartType: "sankey",
      x: "Line No",
      y: "lot",
      z: "온도(℃)",
      agg: "sum",
      // legend 컬럼을 쓰지 않으므로 값이 많은 컬럼이 남아 있어도 통과한다.
      legend: "lot",
    };
    expect(specError(sankey, columns)).toBeUndefined();
    expect(specError({ ...sankey, y: "Line No" }, columns)).toContain(
      "서로 다른",
    );
    expect(specError({ ...sankey, z: null }, columns)).toContain("z 컬럼");
    expect(specError({ ...sankey, y: "온도(℃)" }, columns)).toContain(
      "categorical",
    );
  });

  it("필터 종류와 컬럼 타입", () => {
    expect(
      specError(
        {
          ...base,
          filters: [{ kind: "exclude", column: "온도(℃)", values: ["1"] }],
        },
        columns,
      ),
    ).toContain("categorical");
  });
});
