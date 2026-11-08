// @vitest-environment jsdom
// item 도구는 작업 store를 읽지 않는다. WorkspaceScope 없이 props만으로 그려지고, 고른 값은 콜백으로 알린다.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemState } from "@/shared/api/types";
import { LegendCheckboxes } from "./LegendCheckboxes";
import { PaintToolbar } from "./PaintToolbar";

vi.mock("@/shared/api/queries", () => ({
  useItemMeta: () => ({ data: undefined }),
}));

const item = {
  key: "k",
  label: "item",
  shapeCount: 0,
} as ItemState;

afterEach(cleanup);

describe("store 없이 쓰는 item 도구", () => {
  it("PaintToolbar는 받은 도구를 누른 상태로 보이고, 다른 도구를 누르면 콜백으로 알린다", () => {
    const onToolChange = vi.fn();
    render(
      <PaintToolbar
        item={item}
        busy={false}
        undoCount={0}
        tool="line"
        onToolChange={onToolChange}
        onAction={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "선" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "사각형" }));
    expect(onToolChange).toHaveBeenCalledWith("rect");
  });

  it("LegendCheckboxes는 shown이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <LegendCheckboxes
        shown={false}
        image={{ url: "/png", width: 10, height: 10 }}
        display={{ width: 10, height: 10 }}
        alt="item"
        disabled={false}
        onAction={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
