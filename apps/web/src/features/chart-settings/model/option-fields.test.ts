import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER_CHARTS,
  type ChartOptions,
  type FocusType,
  LEGEND_ORDER_CHARTS,
  mergeOptions,
  OPTION_SECTIONS,
} from "@/entities/chart/model/chart-options";
import { parseNumber } from "../ui/OptionSectionForm";
import {
  buildPatch,
  fieldsOf,
  getPath,
  hasSection,
  isFieldShown,
  LIST_PATHS,
  type OptionField,
  removeSection,
  sectionFields,
  sectionParts,
  sectionPaths,
  setPath,
} from "./option-fields";

// 화면은 서버 기본값을 받아 쓰므로 테스트도 서버 값을 그대로 쓴다.
const DEFAULT_OPTIONS: ChartOptions = CHART_DEFAULTS.options;

describe("option fields", () => {
  it("모든 필드 경로가 ChartOptions에 있다", () => {
    for (const section of OPTION_SECTIONS) {
      for (const field of sectionFields()[section]) {
        if (field.kind === "heading") continue;
        expect(field.path.startsWith(`${section}.`)).toBe(true);
        expect(getPath(DEFAULT_OPTIONS, field.path)).not.toBeUndefined();
      }
    }
  });

  it("하위 항목은 구역 필드를 나눠 갖고, 각자 자기 경로만 쓴다", () => {
    for (const [section, parts] of Object.entries(sectionParts())) {
      const all = parts.flatMap((p) => p.fields);
      expect(all).toEqual(
        sectionFields()[section as keyof ReturnType<typeof sectionParts>],
      );
      for (const part of parts) {
        for (const field of fieldsOf(section as never, part.id)) {
          if (field.kind === "heading") continue;
          expect(field.path.startsWith(`${section}.${part.id}.`)).toBe(true);
        }
      }
    }
    expect(fieldsOf("axes")).toBe(sectionParts().axes?.[0].fields);
    expect(fieldsOf("title")).toBe(sectionFields().title);
  });

  it("setPath는 원본을 바꾸지 않고 깊은 경로에 값을 넣는다", () => {
    const patch = { title: { bold: false } };
    const next = setPath(patch, "axes.y.grid.color", "#000000");
    expect(next).toEqual({
      title: { bold: false },
      axes: { y: { grid: { color: "#000000" } } },
    });
    expect(patch).toEqual({ title: { bold: false } });
    expect(setPath(next, "title.align", "center").title).toEqual({
      bold: false,
      align: "center",
    });
  });

  it("구역을 지우고 남은 게 없으면 undefined", () => {
    const patch = { title: { bold: false }, panel: { border: true } };
    expect(removeSection(patch, "title")).toEqual({ panel: { border: true } });
    expect(removeSection({ title: { bold: false } }, "title")).toBe(undefined);
    expect(hasSection(patch, "panel")).toBe(true);
    expect(hasSection(patch, "axes")).toBe(false);
  });

  it("숫자 칸: 비우면 nullable만 null, 범위 밖은 자른다", () => {
    expect(parseNumber("", { min: 0, max: 10, nullable: true })).toBeNull();
    expect(typeof parseNumber("", { min: 0, max: 10 })).toBe("symbol");
    expect(parseNumber("99", { min: 0, max: 10 })).toBe(10);
    expect(typeof parseNumber("abc", { min: 0, max: 10 })).toBe("symbol");
  });

  describe("buildPatch", () => {
    const resolve = (patch: object | undefined) =>
      mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
    const edit = (patch: object | undefined, path: string, value: unknown) =>
      setPath(resolve(patch), path, value) as ChartOptions;

    it("바꾼 필드만 정하고, 안 바꾸면 원래 부분 값 그대로", () => {
      const original = { title: { bold: false } };
      const opened = resolve(original);
      expect(
        buildPatch({
          original,
          opened,
          base: DEFAULT_OPTIONS,
          values: opened,
          resets: [],
        }),
      ).toEqual(original);
      expect(
        buildPatch({
          original,
          opened,
          base: DEFAULT_OPTIONS,
          values: edit(original, "axes.y.grid.color", "#000000"),
          resets: [],
        }),
      ).toEqual({
        title: { bold: false },
        axes: { y: { grid: { color: "#000000" } } },
      });
    });

    it("바꿨다가 원래 값으로 돌리면 정하지 않는다", () => {
      expect(
        buildPatch({
          original: undefined,
          opened: DEFAULT_OPTIONS,
          base: DEFAULT_OPTIONS,
          values: DEFAULT_OPTIONS,
          resets: [],
        }),
      ).toBeUndefined();
    });

    it("정해 둔 필드는 따르는 값과 같아져도 정한 채로 둔다", () => {
      const original = { title: { bold: false } };
      expect(
        buildPatch({
          original,
          opened: resolve(original),
          base: DEFAULT_OPTIONS,
          values: edit(original, "title.bold", DEFAULT_OPTIONS.title.bold),
          resets: [],
        }),
      ).toEqual({ title: { bold: DEFAULT_OPTIONS.title.bold } });
    });

    it("되돌린 구역은 지우고, 되돌린 뒤 다시 고친 필드만 정한다", () => {
      const original = { title: { bold: false, align: "center" as const } };
      const afterReset = setPath(
        resolve(original),
        "title",
        DEFAULT_OPTIONS.title,
      ) as ChartOptions;
      expect(
        buildPatch({
          original,
          opened: resolve(original),
          base: DEFAULT_OPTIONS,
          values: afterReset,
          resets: ["title"],
        }),
      ).toBeUndefined();
      expect(
        buildPatch({
          original,
          opened: resolve(original),
          base: DEFAULT_OPTIONS,
          values: setPath(afterReset, "title.fontSize", 30) as ChartOptions,
          resets: ["title"],
        }),
      ).toEqual({ title: { fontSize: 30 } });
    });
  });
});

describe("설정 창 필드", () => {
  /** 기본값의 끝 칸 경로 ("title.summary.color" 등). 배열은 통째로 한 칸이다. */
  function leafPaths(value: unknown, prefix = ""): string[] {
    if (value && typeof value === "object" && !Array.isArray(value))
      return Object.entries(value).flatMap(([key, v]) =>
        leafPaths(v, prefix ? `${prefix}.${key}` : key),
      );
    return [prefix];
  }

  it("서버 기본값의 모든 칸을 설정 창에서 바꿀 수 있다", () => {
    const paths = new Set<string>();
    for (const section of OPTION_SECTIONS) {
      const parts = sectionParts()[section];
      const fields = parts
        ? parts.flatMap((p) => p.fields)
        : sectionFields()[section];
      for (const f of fields) if ("path" in f) paths.add(f.path);
    }
    // 배열 칸 중 전용 컴포넌트가 편집하는 경로 (관리선 선 목록)
    const lists = Object.values(LIST_PATHS).flat();
    expect(lists).toEqual(["controlLimit.lines"]);
    for (const path of lists) paths.add(path);
    expect(leafPaths(DEFAULT_OPTIONS).filter((p) => !paths.has(p))).toEqual([]);
  });

  it("전용 컴포넌트의 배열 칸은 구역 경로에 들고 필드 표와 겹치지 않는다", () => {
    for (const [section, lists] of Object.entries(LIST_PATHS)) {
      const own = sectionFields()[section as keyof typeof LIST_PATHS];
      for (const path of lists ?? []) {
        expect(path.startsWith(`${section}.`)).toBe(true);
        expect(Array.isArray(getPath(DEFAULT_OPTIONS, path))).toBe(true);
        expect(own.some((f) => "path" in f && f.path === path)).toBe(false);
        expect(sectionPaths(section as never)).toContain(path);
      }
    }
  });
});

describe("새 칸 (순서·강조 방식·이상치·팔레트·부제목)", () => {
  const resolve = (patch: object | undefined) =>
    mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
  const edit = (patch: object | undefined, path: string, value: unknown) =>
    setPath(resolve(patch), path, value) as ChartOptions;
  /** 보이는 입력 칸 경로 */
  const shown = (
    fields: OptionField[],
    options: ChartOptions,
    chartType: Parameters<typeof isFieldShown>[2],
  ) =>
    fields.flatMap((f) =>
      f.kind !== "heading" && isFieldShown(f, options, chartType)
        ? [f.path]
        : [],
    );

  it("강조 방식마다 그 방식의 칸만 보이고, 대상·색·모양·크기는 늘 보인다", () => {
    const visible = (type: FocusType) =>
      shown(
        sectionFields().focus,
        edit(undefined, "focus.type", type),
        "scatter",
      );
    const always = [
      "focus.enabled",
      "focus.type",
      "focus.target",
      "focus.color",
      "focus.shape",
      "focus.size",
      "focus.legendSingleColor",
    ];
    expect(visible("condition")).toEqual(
      expect.arrayContaining([...always, "focus.operator", "focus.value"]),
    );
    expect(visible("condition")).toHaveLength(always.length + 2);
    expect(visible("rank").sort()).toEqual(
      [...always, "focus.rankFrom", "focus.rankCount"].sort(),
    );
    expect(visible("range").sort()).toEqual(
      [...always, "focus.rangeMin", "focus.rangeMax"].sort(),
    );
  });

  it("이상치 처리는 이상치 가리기를 켰을 때만 보인다", () => {
    const fields = sectionFields().value;
    expect(shown(fields, DEFAULT_OPTIONS, "bar")).not.toContain(
      "value.outlierMode",
    );
    expect(
      shown(fields, edit(undefined, "value.outlier", true), "bar"),
    ).toContain("value.outlierMode");
  });

  it("legend 순서는 legend 컬럼을 고르는 차트만, 범주 순서는 범주 x축 차트의 X축에만 보인다", () => {
    for (const type of ["scatter", "bar", "gantt", "treemap"] as const) {
      expect(LEGEND_ORDER_CHARTS).toContain(type);
      expect(shown(sectionFields().legend, DEFAULT_OPTIONS, type)).toEqual(
        expect.arrayContaining(["legend.sort", "legend.order"]),
      );
    }
    for (const type of ["pie", "funnel", "sankey"] as const)
      expect(
        shown(sectionFields().legend, DEFAULT_OPTIONS, type),
      ).not.toContain("legend.order");
    const x = fieldsOf("axes", "x");
    for (const type of CATEGORY_ORDER_CHARTS)
      expect(shown(x, DEFAULT_OPTIONS, type)).toEqual(
        expect.arrayContaining(["axes.x.categorySort", "axes.x.categoryOrder"]),
      );
    for (const type of ["scatter", "line", "gantt"] as const)
      expect(shown(x, DEFAULT_OPTIONS, type)).not.toContain(
        "axes.x.categoryOrder",
      );
    expect(
      shown(fieldsOf("axes", "y"), DEFAULT_OPTIONS, "bar").some((p) =>
        p.includes("category"),
      ),
    ).toBe(false);
  });

  it("순서 칸은 나머지 순서를 정하는 정렬 칸을 가리킨다", () => {
    const order = [...sectionFields().legend, ...fieldsOf("axes", "x")].filter(
      (f) => f.kind === "order",
    );
    expect(order.map((f) => [f.path, f.sortPath, f.source])).toEqual([
      ["legend.order", "legend.sort", "legend"],
      ["axes.x.categoryOrder", "axes.x.categorySort", "category"],
    ]);
  });

  it("배열 칸(순서·색 목록)은 통째로 저장하고, 원래대로 돌리면 정하지 않는다", () => {
    const values = edit(
      edit(undefined, "legend.order", ["L10", "L2"]),
      "palette.colors",
      ["#111111", "#222222"],
    );
    expect(
      buildPatch({
        original: undefined,
        opened: DEFAULT_OPTIONS,
        base: DEFAULT_OPTIONS,
        values,
        resets: [],
      }),
    ).toEqual({
      legend: { order: ["L10", "L2"] },
      palette: { colors: ["#111111", "#222222"] },
    });
    // 순서를 줄이면 줄인 배열이 그대로 남는다 (합칠 때 배열은 통째로 바뀐다).
    const original = { legend: { order: ["L10", "L2"] } };
    expect(
      buildPatch({
        original,
        opened: resolve(original),
        base: DEFAULT_OPTIONS,
        values: edit(original, "legend.order", ["L2"]),
        resets: [],
      }),
    ).toEqual({ legend: { order: ["L2"] } });
    expect(
      buildPatch({
        original: undefined,
        opened: DEFAULT_OPTIONS,
        base: DEFAULT_OPTIONS,
        values: edit(undefined, "axes.x.categoryOrder", []),
        resets: [],
      }),
    ).toBeUndefined();
  });

  it("강조 방식·순위·범위와 부제목 칸을 저장한다. 비운 칸은 null로 남는다", () => {
    let values = edit(undefined, "focus.type", "range");
    values = setPath(values, "focus.rangeMin", 20) as ChartOptions;
    values = setPath(values, "title.subtitleAlign", "right") as ChartOptions;
    values = setPath(values, "title.subtitleFontSize", 9) as ChartOptions;
    const patch = buildPatch({
      original: undefined,
      opened: DEFAULT_OPTIONS,
      base: DEFAULT_OPTIONS,
      values,
      resets: [],
    });
    expect(patch).toEqual({
      focus: { type: "range", rangeMin: 20 },
      title: { subtitleAlign: "right", subtitleFontSize: 9 },
    });
    // 정해 둔 칸은 비워도(null = 제목 따라감) 정한 채로 남는다.
    const original = { title: { subtitleAlign: "right" as const } };
    expect(
      buildPatch({
        original,
        opened: resolve(original),
        base: DEFAULT_OPTIONS,
        values: edit(original, "title.subtitleAlign", null),
        resets: [],
      }),
    ).toEqual({ title: { subtitleAlign: null } });
  });

  it("구역을 되돌리면 새 칸도 함께 지운다", () => {
    const original = {
      legend: { sort: "natural" as const, order: ["b", "a"] },
      focus: { type: "rank" as const, rankCount: 3 },
      value: { outlier: true, outlierMode: "only" as const },
    };
    const reset = (section: "legend" | "focus" | "value") =>
      setPath(
        resolve(original),
        section,
        DEFAULT_OPTIONS[section],
      ) as ChartOptions;
    for (const section of ["legend", "focus", "value"] as const) {
      const patch = buildPatch({
        original,
        opened: resolve(original),
        base: DEFAULT_OPTIONS,
        values: reset(section),
        resets: [section],
      });
      expect(patch?.[section]).toBeUndefined();
      expect(Object.keys(patch ?? {}).sort()).toEqual(
        Object.keys(original)
          .filter((k) => k !== section)
          .sort(),
      );
    }
  });
});
