import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import {
  type ChartOptions,
  type LimitLine,
  type LimitSupport,
  mergeOptions,
} from "@/entities/chart/model/chart-options";
import type { ColumnInfo } from "@/shared/api/types";
import {
  addableKinds,
  axesFor,
  checkLimitLines,
  isoToKstInput,
  kstInputToIso,
  limitSourceOf,
  newLimitLine,
  uniqueLimitName,
  usesControlLimit,
  withAxis,
} from "./control-limit-form";
import { buildPatch, setPath } from "./option-fields";

const DEFAULTS: ChartOptions = CHART_DEFAULTS.options;

const col = (name: string, type: ColumnInfo["type"]): ColumnInfo => ({
  name,
  label: name,
  type,
  nullable: true,
  distinct: null,
});
const columns = [
  col("ts", "datetime"),
  col("value", "numeric"),
  col("temp", "numeric"),
  col("factory", "categorical"),
];

const scatter = limitSourceOf(
  { chartType: "scatter", x: "ts", y: "value" },
  columns,
);
/** 관리선을 쓰는 차트의 support (없으면 테스트가 틀린 것) */
function supportOf(source: { support: LimitSupport | null }): LimitSupport {
  if (!source.support) throw new Error("관리선을 쓰지 않는 차트");
  return source.support;
}
const supported = { ...scatter, support: supportOf(scatter) };

describe("선 목록 편집 정보", () => {
  it("차트·하위 차트·x 타입으로 종류와 축을 고른다", () => {
    expect(scatter.xType).toBe("datetime");
    expect(addableKinds(supportOf(scatter))).toEqual([
      "reference",
      "column",
      "band",
    ]);
    // 시계열 x의 Bottom 축은 기준선만
    expect(axesFor(supportOf(scatter), "column")).toEqual(["left"]);
    expect(axesFor(supportOf(scatter), "reference")).toEqual([
      "left",
      "bottom",
    ]);
    const stack = limitSourceOf(
      { chartType: "bar", subType: "stack", x: "factory", y: "value" },
      columns,
    );
    expect(addableKinds(supportOf(stack))).toEqual(["reference"]);
    const side = limitSourceOf(
      { chartType: "bar", x: "factory", y: "value" },
      columns,
    );
    expect(addableKinds(supportOf(side))).toEqual(["reference", "column"]);
    expect(side.support?.multi).toBe(false);
  });

  it("분포 line과 관리선 구역이 없는 차트는 구역을 끈다", () => {
    expect(usesControlLimit({ chartType: "line", subType: "ecdf" })).toBe(
      false,
    );
    expect(usesControlLimit({ chartType: "pie" })).toBe(false);
    expect(usesControlLimit({ chartType: "line" })).toBe(true);
    expect(
      limitSourceOf({ chartType: "boxplot", x: "factory", y: "value" }, columns)
        .support,
    ).toBeNull();
  });
});

describe("새 선과 축 바꾸기", () => {
  it("종류마다 그 종류의 칸만 갖고, 컬럼은 y(숫자면)부터 고른다", () => {
    const reference = newLimitLine("reference", supported, [], "기준선 1");
    expect(reference).toMatchObject({
      kind: "reference",
      axis: "left",
      value: 0,
      type: "none",
    });
    expect(reference).not.toHaveProperty("column");
    const column = newLimitLine("column", supported, [reference], "컬럼 선 1");
    expect(column).toMatchObject({
      kind: "column",
      column: "value",
      fn: "avg",
      type: "none",
      multi: false,
    });
    expect(column).not.toHaveProperty("value");
    expect(column.color).not.toBe(reference.color);
    const band = newLimitLine("band", supported, [], "띠 1");
    expect(band).toMatchObject({ column: "value", column2: "temp" });
    expect(band).not.toHaveProperty("type");
  });

  it("목록에 없는 이름을 붙인다", () => {
    const lines = [
      newLimitLine("reference", supported, [], "기준선 1"),
      newLimitLine("reference", supported, [], "기준선 2"),
    ];
    expect(uniqueLimitName("기준선", lines)).toBe("기준선 3");
    expect(uniqueLimitName("띠", lines)).toBe("띠 1");
  });

  it("시계열 x의 Bottom으로 옮긴 기준선은 시각 값, Left로 돌리면 숫자. 구간별은 Left에서만", () => {
    const reference = newLimitLine("reference", supported, [], "R");
    const bottom = withAxis(reference, "bottom", "datetime");
    expect(bottom).toMatchObject({ axis: "bottom", value: "" });
    expect(withAxis(bottom, "left", "datetime")).toMatchObject({ value: 0 });
    // 숫자 x면 값을 그대로 둔다.
    expect(
      withAxis({ ...reference, value: 7 } as LimitLine, "bottom", "numeric"),
    ).toMatchObject({ value: 7 });
    const multi = {
      ...newLimitLine("column", supported, [], "C"),
      multi: true,
    } as LimitLine;
    expect(withAxis(multi, "bottom", "numeric")).toMatchObject({
      multi: false,
    });
  });

  it("시각 칸은 KST로 보이고 ISO(+09:00)로 저장한다", () => {
    const iso = kstInputToIso("2026-11-01T09:30");
    expect(iso).toBe("2026-11-01T09:30:00+09:00");
    expect(Date.parse(iso)).toBe(Date.UTC(2026, 10, 1, 0, 30));
    expect(isoToKstInput(iso)).toBe("2026-11-01T09:30");
    expect(isoToKstInput("2026-11-01T00:30:00Z")).toBe("2026-11-01T09:30");
    expect(kstInputToIso("")).toBe("");
    expect(isoToKstInput("")).toBe("");
  });
});

describe("checkLimitLines (확인 막기)", () => {
  it("맞지 않는 선이 있으면 첫 사유로 막는다", () => {
    const a = newLimitLine("reference", supported, [], "A");
    const b = { ...a, value: "" } as LimitLine;
    expect(checkLimitLines([a], scatter).blocked).toBeUndefined();
    const check = checkLimitLines([a, b], scatter);
    expect(check.issues.map((i) => i?.code)).toEqual([
      undefined,
      "name-duplicate",
    ]);
    expect(check.blocked).toContain("A");
  });

  it("관리선을 쓰지 않는 차트에서는 막지 않는다 (서버도 보지 않는다)", () => {
    const bad = { ...newLimitLine("column", supported, [], "") } as LimitLine;
    const ecdf = limitSourceOf(
      { chartType: "line", subType: "ecdf", x: "ts", y: "value" },
      columns,
    );
    expect(checkLimitLines([bad], scatter).blocked).toBeDefined();
    expect(checkLimitLines([bad], ecdf).blocked).toBeUndefined();
  });
});

describe("폼 ↔ patch (선 목록은 통째로)", () => {
  const resolve = (patch: object | undefined, base = DEFAULTS) =>
    mergeOptions<ChartOptions>(base, patch);
  const line = newLimitLine("reference", supported, [], "USL");
  const withLines = (options: ChartOptions, lines: LimitLine[]) =>
    setPath(options, "controlLimit.lines", lines) as ChartOptions;

  it("공통 속성: 선을 더하면 목록 전체를, 낱개 칸은 바꾼 것만 저장한다", () => {
    let values = withLines(DEFAULTS, [line]);
    values = setPath(values, "controlLimit.area.visible", true) as ChartOptions;
    expect(
      buildPatch({
        original: undefined,
        opened: DEFAULTS,
        base: DEFAULTS,
        values,
        resets: [],
      }),
    ).toEqual({ controlLimit: { lines: [line], area: { visible: true } } });
  });

  it("선 하나의 칸을 고치면 목록 전체가 바뀐 값으로 남는다", () => {
    const original = { controlLimit: { lines: [line] } };
    const edited = { ...line, color: "#000000" } as LimitLine;
    expect(
      buildPatch({
        original,
        opened: resolve(original),
        base: DEFAULTS,
        values: withLines(resolve(original), [edited]),
        resets: [],
      }),
    ).toEqual({ controlLimit: { lines: [edited] } });
  });

  it("item: 공통 선을 모두 지우면 []를 저장해 그 item만 선이 없고, 되돌리면 공통을 따른다", () => {
    const common = resolve({ controlLimit: { lines: [line] } });
    expect(
      buildPatch({
        original: undefined,
        opened: common,
        base: common,
        values: withLines(common, []),
        resets: [],
      }),
    ).toEqual({ controlLimit: { lines: [] } });
    // 공통과 같은 목록이면 정하지 않는다 (공통을 따른다).
    expect(
      buildPatch({
        original: undefined,
        opened: common,
        base: common,
        values: common,
        resets: [],
      }),
    ).toBeUndefined();
    // 구역 되돌리기: item 목록을 지우고 공통을 따른다.
    const original = { controlLimit: { lines: [] }, title: { bold: false } };
    expect(
      buildPatch({
        original,
        opened: resolve(original, common),
        base: common,
        values: resolve({ title: { bold: false } }, common),
        resets: ["controlLimit"],
      }),
    ).toEqual({ title: { bold: false } });
  });
});
