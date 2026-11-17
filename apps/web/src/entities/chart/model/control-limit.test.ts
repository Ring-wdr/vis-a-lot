import { describe, expect, it } from "vitest";
import type { ChartSpec, ColumnInfo } from "@/shared/api/types";
import {
  controlLimitSupport,
  type LimitLine,
  type LimitSupport,
} from "./chart-options";
import { fitControlLimit, fitLimitLines, limitIssues } from "./control-limit";

const col = (name: string, type: ColumnInfo["type"]): ColumnInfo => ({
  name,
  label: name,
  type,
  nullable: true,
  distinct: null,
});

const iot = [
  col("ts", "datetime"),
  col("value", "numeric"),
  col("usl", "numeric"),
  col("lsl", "numeric"),
  col("factory", "categorical"),
];

const look = {
  color: "#e03131",
  width: 1.5,
  style: "dash" as const,
};
const ref = (
  name: string,
  value: number | string,
  over: Partial<LimitLine> = {},
): LimitLine =>
  ({
    name,
    axis: "left",
    ...look,
    kind: "reference",
    value,
    type: "none",
    ...over,
  }) as LimitLine;
const column = (
  name: string,
  over: Partial<Extract<LimitLine, { kind: "column" }>> = {},
): LimitLine => ({
  name,
  axis: "left",
  ...look,
  kind: "column",
  column: "usl",
  fn: "avg",
  type: "none",
  multi: false,
  ...over,
});
const band = (
  name: string,
  over: Partial<Extract<LimitLine, { kind: "band" }>> = {},
): LimitLine => ({
  name,
  axis: "left",
  ...look,
  kind: "band",
  column: "lsl",
  column2: "usl",
  multi: false,
  ...over,
});

const scatter = controlLimitSupport(
  { chartType: "scatter" },
  "datetime",
) as LimitSupport;
const bar = controlLimitSupport({ chartType: "bar" }) as LimitSupport;
const stack = controlLimitSupport({
  chartType: "bar",
  subType: "stack",
}) as LimitSupport;

describe("limitIssues (서버 controlLimitError와 같은 규칙)", () => {
  const context = {
    support: scatter,
    columns: iot,
    xType: "datetime" as const,
  };

  it("맞는 선은 사유가 없다", () => {
    expect(
      limitIssues(
        [
          ref("USL", 80, { type: "usl" } as Partial<LimitLine>),
          column("평균", { fn: "median", multi: true }),
          band("띠"),
          ref("기준 시각", "2026-11-01T09:00:00+09:00", { axis: "bottom" }),
        ],
        context,
      ),
    ).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("빈·겹치는 이름, 겹치는 USL, 띠의 같은 컬럼", () => {
    expect(
      limitIssues(
        [
          ref(" ", 1),
          ref("A", 1, { type: "usl" } as Partial<LimitLine>),
          ref("A", 2),
          column("B", { type: "usl" }),
          band("C", { column2: "lsl" }),
        ],
        context,
      ).map((i) => i?.code),
    ).toEqual([
      "name-empty",
      undefined,
      "name-duplicate",
      "spec-duplicate",
      "band-same",
    ]);
  });

  it("없는·숫자형이 아닌 컬럼, 축에 맞지 않는 값과 종류, 구간별", () => {
    expect(
      limitIssues(
        [
          column("a", { column: "nope" }),
          column("b", { column: "factory" }),
          ref("c", 3, { axis: "bottom" }),
          ref("d", "x"),
          column("e", { axis: "bottom", multi: true }),
        ],
        { support: scatter, columns: iot, xType: "datetime" },
      ).map((i) => i?.code),
    ).toEqual([
      "column-missing",
      "column-type",
      "value-time",
      "value-number",
      "kind-axis",
    ]);
    expect(
      limitIssues([column("a", { multi: true })], {
        support: bar,
        columns: iot,
        xType: "categorical",
      })[0]?.code,
    ).toBe("multi");
  });

  it("스키마를 받기 전에는 컬럼을 보지 않는다", () => {
    expect(
      limitIssues([column("a", { column: "nope" })], {
        support: scatter,
        columns: undefined,
        xType: undefined,
      }),
    ).toEqual([undefined]);
  });
});

describe("fitLimitLines", () => {
  it("bar Side → Stack이면 컬럼 선을 지우고 기준선은 남긴다", () => {
    const lines = [ref("R", 1), column("C")];
    expect(fitLimitLines(lines, bar, iot, "categorical")).toBe(lines);
    expect(fitLimitLines(lines, stack, iot, "categorical")).toEqual([
      ref("R", 1),
    ]);
  });

  it("없는 컬럼의 선을 지우고, 구간별을 못 쓰는 곳은 구간별만 끈다", () => {
    const lines = [
      column("C", { multi: true }),
      band("B", { column2: "gone" }),
    ];
    expect(fitLimitLines(lines, bar, iot, "categorical")).toEqual([
      column("C"),
    ]);
  });

  it("x가 시계열로 바뀌면 숫자 값의 Bottom 기준선과 Bottom 컬럼 선을 지운다", () => {
    const numericX = controlLimitSupport({ chartType: "scatter" }, "numeric");
    const lines = [
      ref("x0", 5, { axis: "bottom" }),
      column("xc", { axis: "bottom" }),
      ref("y0", 5),
    ];
    expect(fitLimitLines(lines, numericX, iot, "numeric")).toBe(lines);
    expect(fitLimitLines(lines, scatter, iot, "datetime")).toEqual([
      ref("y0", 5),
    ]);
  });

  it("관리선을 쓰지 않는 차트·하위 차트에서는 그대로 둔다", () => {
    const lines = [column("C", { column: "nope" })];
    expect(fitLimitLines(lines, null, iot, undefined)).toBe(lines);
  });
});

describe("fitControlLimit (draft 바로잡기)", () => {
  const spec: ChartSpec = {
    dataset: "iot-100k",
    chartType: "scatter",
    x: "ts",
    y: "value",
    agg: "avg",
    legend: null,
    splitBy: [],
    splitSeparator: "-",
    tooltip: [],
    grid: { rows: 1, cols: 1 },
    common: {
      color: "#2a78d6",
      options: {
        title: { bold: true },
        controlLimit: {
          highlightOut: false,
          lines: [column("C"), ref("R", 1)],
        },
      },
    },
  };

  it("다른 데이터셋으로 바꾸면 스키마에 없는 컬럼을 쓰는 선을 지운다", () => {
    const plant = [col("검사일시", "datetime"), col("두께", "numeric")];
    expect(fitControlLimit({ ...spec, x: "검사일시" }, plant)).toEqual({
      common: {
        color: "#2a78d6",
        options: {
          title: { bold: true },
          controlLimit: { highlightOut: false, lines: [ref("R", 1)] },
        },
      },
    });
  });

  it("맞으면 바꾸지 않고, 분포 line에서는 보지 않는다", () => {
    expect(fitControlLimit(spec, iot)).toBeUndefined();
    expect(
      fitControlLimit({ ...spec, chartType: "line", subType: "ecdf" }, [
        col("value", "numeric"),
      ]),
    ).toBeUndefined();
    expect(
      fitControlLimit({ ...spec, common: { color: "#000000" } }, []),
    ).toBeUndefined();
  });
});
