import { describe, expect, it } from "vitest";
import type { ChartSpec } from "../api/types";
import type { LimitLine } from "../render/options";
import { controlLimitError, specError } from "./validate-spec";

// 고정 이름이 아닌, 아무 공장의 raw data 같은 컬럼들
const columns = [
  { name: "측정일시", label: "측정일시", type: "datetime", distinct: null },
  { name: "Line No", label: "Line No", type: "categorical", distinct: 4 },
  { name: "lot", label: "lot", type: "categorical", distinct: 500 },
  { name: "온도(℃)", label: "온도", type: "numeric", distinct: 900 },
  { name: "상한", label: "상한", type: "numeric", distinct: 3 },
  { name: "하한", label: "하한", type: "numeric", distinct: 3 },
  { name: "번호", label: "번호", type: "numeric", distinct: 1000 },
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

describe("관리선 검사", () => {
  const style = { color: "#e03131", width: 1, style: "dash" } as const;
  const usl: LimitLine = {
    ...style,
    name: "USL",
    axis: "left",
    kind: "reference",
    value: 80,
    type: "usl",
  };
  const mean: LimitLine = {
    ...style,
    name: "평균",
    axis: "left",
    kind: "column",
    column: "온도(℃)",
    fn: "avg",
    type: "none",
    multi: false,
  };
  const band: LimitLine = {
    ...style,
    name: "규격 띠",
    axis: "left",
    kind: "band",
    column: "하한",
    column2: "상한",
    multi: true,
  };
  const withLines = (spec: Partial<ChartSpec>, lines: LimitLine[]) => ({
    ...base,
    ...spec,
    common: { ...base.common, options: { controlLimit: { lines } } },
  });
  const check = (spec: Partial<ChartSpec>, lines: LimitLine[]) =>
    controlLimitError({ ...base, ...spec }, lines, columns);
  const bar = { chartType: "bar", x: "Line No" } as const;

  it("draw는 공통 속성의 선을 함께 본다", () => {
    expect(
      specError(withLines({}, [usl, mean, band]), columns),
    ).toBeUndefined();
    expect(
      specError(withLines({}, [{ ...mean, column: "없음" }]), columns),
    ).toContain("데이터에 없습니다");
  });

  it("없는 컬럼·범주 컬럼은 거절한다", () => {
    expect(check({}, [{ ...mean, column: "ts" }])).toContain(
      "데이터에 없습니다",
    );
    expect(check({}, [{ ...mean, column: "Line No" }])).toContain("numeric");
    expect(check({}, [{ ...band, column2: "측정일시" }])).toContain("numeric");
    expect(check({}, [{ ...band, column2: "하한" }])).toContain(
      "서로 다른 두 컬럼",
    );
  });

  it("이름은 비지 않고 겹치지 않는다", () => {
    expect(check({}, [{ ...usl, name: "  " }])).toContain("이름을 적어");
    expect(check({}, [usl, { ...mean, name: "USL " }])).toContain("두 번");
  });

  it("축마다 USL·LSL은 하나씩", () => {
    expect(check({}, [usl, { ...mean, type: "usl" }])).toContain("하나씩만");
    expect(
      check({ x: "번호" }, [usl, { ...usl, name: "x 상한", axis: "bottom" }]),
    ).toBeUndefined();
  });

  it("차트와 맞지 않는 축·종류는 거절한다", () => {
    // bar는 Left 축만, 구간별 없음, Stack은 기준선만
    expect(check(bar, [usl, mean])).toBeUndefined();
    expect(check(bar, [{ ...usl, axis: "bottom" }])).toContain("Bottom");
    expect(check(bar, [band])).toContain("띠");
    expect(check(bar, [{ ...mean, multi: true }])).toContain("구간별");
    expect(check({ ...bar, subType: "stack" }, [usl])).toBeUndefined();
    expect(check({ ...bar, subType: "stack100" }, [mean])).toContain("컬럼 선");
    // 구간별은 Left 축에서만
    expect(
      check({ x: "번호" }, [{ ...mean, axis: "bottom", multi: true }]),
    ).toContain("구간별");
  });

  it("시계열 x의 Bottom 축은 ISO 시각 기준선만", () => {
    const at = {
      ...usl,
      axis: "bottom",
      value: "2024-03-01T00:00:00Z",
    } as const;
    expect(check({}, [at])).toBeUndefined();
    expect(check({}, [{ ...at, value: 3 }])).toContain("시각");
    expect(check({}, [{ ...at, value: "어제" }])).toContain("시각");
    expect(check({}, [{ ...mean, axis: "bottom" }])).toContain("Bottom");
    // 숫자 x면 Bottom에 컬럼 선을 쓰고, 기준선 값은 숫자다.
    expect(check({ x: "번호" }, [{ ...mean, axis: "bottom" }])).toBeUndefined();
    expect(check({ x: "번호" }, [at])).toContain("숫자");
    expect(check({}, [{ ...usl, value: "80" }])).toContain("숫자");
  });

  it("관리선을 쓰지 않는 차트·하위 차트에서는 보지 않는다", () => {
    const broken = [{ ...mean, column: "없음" }];
    expect(
      check({ chartType: "line", subType: "ecdf" }, broken),
    ).toBeUndefined();
    expect(check({ chartType: "line" }, broken)).toContain("데이터에 없습니다");
    expect(
      check({ chartType: "boxplot", x: "Line No" }, broken),
    ).toBeUndefined();
  });
});
