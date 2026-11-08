import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it } from "vitest";
import {
  type ChartOptions,
  mergeOptions,
  OPTION_SECTIONS,
} from "@/entities/chart/model/chart-options";
import { parseNumber } from "../ui/OptionSectionForm";
import {
  buildPatch,
  fieldsOf,
  getPath,
  hasSection,
  removeSection,
  sectionFields,
  sectionParts,
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
    expect(leafPaths(DEFAULT_OPTIONS).filter((p) => !paths.has(p))).toEqual([]);
  });
});
