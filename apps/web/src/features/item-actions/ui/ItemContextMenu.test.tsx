// @vitest-environment jsdom
// 우클릭 메뉴의 `선택 값 복사`: 선택 값 필드를 정한 item에만 두고, 선택이 없으면 막는다.

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ChartOptionsPatch,
  selectionFieldsOf,
} from "@/entities/chart/model/chart-options";
import type { ChartSpec, ItemState } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import {
  copyNotice,
  selectionValuesText,
} from "../model/copy-selection-values";
import { ItemContextMenu } from "./ItemContextMenu";

afterEach(cleanup);

const item = (selectedCount?: number) =>
  ({
    key: "k",
    label: "item",
    selectedCount,
    favorites: [],
    legendGroups: [],
    deletionCount: 0,
  }) as unknown as ItemState;

function openMenu(state: ItemState, onCopy?: () => void) {
  renderWithI18n(
    <ItemContextMenu
      item={state}
      disabled={false}
      className="item"
      onAction={() => {}}
      onCopySelectionValues={onCopy}
    >
      <span>chart</span>
    </ItemContextMenu>,
  );
  fireEvent.contextMenu(screen.getByText("chart"));
}

describe("우클릭 메뉴의 선택 값 복사", () => {
  it("선택 값 필드가 없으면(콜백 없음) 메뉴에 두지 않는다", () => {
    openMenu(item(3));
    expect(screen.getByRole("menuitem", { name: "선택 해제" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "선택 값 복사" })).toBe(null);
  });

  it("필드가 있으면 두고, 누르면 콜백을 부른다", () => {
    const onCopy = vi.fn();
    openMenu(item(3), onCopy);
    fireEvent.click(screen.getByRole("menuitem", { name: "선택 값 복사" }));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("선택 영역이 없으면 막는다", () => {
    openMenu(item(undefined), vi.fn());
    const entry = screen.getByRole("menuitem", { name: "선택 값 복사" });
    expect(entry.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("selectionFieldsOf (메뉴를 둘지 정하는 필드)", () => {
  const spec = (
    over: Partial<ChartSpec>,
    fields?: string[],
  ): Pick<ChartSpec, "chartType" | "subType" | "common"> => ({
    chartType: "scatter",
    ...over,
    common: {
      color: "#000000",
      ...(fields && { options: { selection: { fields } } }),
    },
  });
  const itemOptions = (fields: string[]): ChartOptionsPatch => ({
    selection: { fields },
  });

  it("item 개별 → 공통 → 빈 목록 순이다", () => {
    expect(selectionFieldsOf(spec({}, ["a"]), undefined)).toEqual(["a"]);
    expect(selectionFieldsOf(spec({}, ["a"]), itemOptions([]))).toEqual([]);
    expect(selectionFieldsOf(spec({}), itemOptions(["b"]))).toEqual(["b"]);
    expect(selectionFieldsOf(spec({}), undefined)).toEqual([]);
    expect(selectionFieldsOf(undefined, undefined)).toEqual([]);
  });

  it("선택 필드를 쓰지 않는 차트와 분포 line은 빈 목록이다", () => {
    expect(
      selectionFieldsOf(spec({ chartType: "pie" }, ["a"]), undefined),
    ).toEqual([]);
    expect(
      selectionFieldsOf(
        spec({ chartType: "line", subType: "ecdf" }, ["a"]),
        undefined,
      ),
    ).toEqual([]);
    for (const chartType of [
      "bar",
      "boxplot",
      "histogram",
      "waterfall",
    ] as const)
      expect(selectionFieldsOf(spec({ chartType }, ["a"]), undefined)).toEqual([
        "a",
      ]);
  });
});

describe("복사 글자와 알림", () => {
  it("값마다 한 줄로 잇는다", () => {
    expect(selectionValuesText(["m1-L1", "m2-"])).toBe("m1-L1\nm2-");
  });

  it("다 담았으면 알리지 않고, 잘렸거나 값이 없으면 알린다", () => {
    expect(
      copyNotice({ values: ["a"], total: 1, truncated: false }),
    ).toBeUndefined();
    expect(copyNotice({ values: [], total: 0, truncated: false })).toBe(
      "복사할 선택 값이 없습니다.",
    );
    expect(
      copyNotice({
        values: Array.from({ length: 1000 }, (_, i) => String(i)),
        total: 1200,
        truncated: true,
      }),
    ).toContain("1,200");
  });
});
