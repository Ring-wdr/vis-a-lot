import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  OPTION_SECTIONS,
} from "@/entities/chart/model/chart-options";
import { parseNumber } from "../ui/OptionSectionForm";
import {
  getPath,
  hasSection,
  removeSection,
  SECTION_FIELDS,
  setPath,
} from "./option-fields";

describe("option fields", () => {
  it("모든 필드 경로가 ChartOptions에 있다", () => {
    for (const section of OPTION_SECTIONS) {
      for (const field of SECTION_FIELDS[section]) {
        if (field.kind === "heading") continue;
        expect(field.path.startsWith(`${section}.`)).toBe(true);
        expect(getPath(DEFAULT_OPTIONS, field.path)).not.toBeUndefined();
      }
    }
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
});
