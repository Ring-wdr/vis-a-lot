import { describe, expect, it } from "vitest";
import { applyItemChanges } from "./item-props";

describe("applyItemChanges", () => {
  it("한 번에 보낸 여러 속성을 모두 적용한다", () => {
    expect(
      applyItemChanges(
        undefined,
        {
          color: "#112233",
          legendPosition: "bottom",
          options: { title: { bold: false } },
        },
        "scatter",
      ),
    ).toEqual({
      color: "#112233",
      legendPosition: "bottom",
      options: { title: { bold: false } },
    });
  });

  it("color: null을 먼저 적용한 뒤 legend 값별 색을 넣는다", () => {
    const current = {
      color: "#000000",
      legendColors: { A: "#111111", B: "#222222" },
    };
    expect(
      applyItemChanges(
        current,
        { color: null, legendColors: { C: "#333333" } },
        "scatter",
      ),
    ).toEqual({ legendColors: { C: "#333333" } });
  });

  it("legend 값별 색 null은 그 값만 되돌리고, 다 없어지면 공통 속성을 따른다", () => {
    const current = { legendColors: { A: "#111111", B: "#222222" } };
    expect(
      applyItemChanges(current, { legendColors: { A: null } }, "scatter"),
    ).toEqual({ legendColors: { B: "#222222" } });
    expect(
      applyItemChanges(
        current,
        { legendColors: { A: null, B: null } },
        "scatter",
      ),
    ).toBeUndefined();
  });

  it("없는 키는 그대로 두고, legend 체크박스로 끈 값을 지킨다", () => {
    const current = {
      legendPosition: "left" as const,
      hiddenLegend: ["A"],
    };
    expect(applyItemChanges(current, {}, "scatter")).toEqual(current);
    expect(
      applyItemChanges(current, { legendPosition: null }, "scatter"),
    ).toEqual({ hiddenLegend: ["A"] });
    expect(
      applyItemChanges(
        current,
        { legendVisible: { value: "A", visible: true } },
        "scatter",
      ),
    ).toEqual({ legendPosition: "left" });
  });

  it("차트가 쓰지 않는 구역의 속성은 버린다", () => {
    expect(
      applyItemChanges(undefined, { options: { axes: {} } }, "pie"),
    ).toBeUndefined();
  });
});
