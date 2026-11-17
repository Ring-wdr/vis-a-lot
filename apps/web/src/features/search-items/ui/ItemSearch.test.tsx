// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ItemSearch, NO_SEARCH } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { MAX_SEARCH_CONDS } from "../model/search-conds";
import { ItemSearchField } from "./ItemSearch";

/** 바뀐 조건을 그대로 다시 넘기는 컨테이너 대역 */
function Harness({
  initial = NO_SEARCH,
  onChange,
}: {
  initial?: ItemSearch;
  onChange: (search: ItemSearch) => void;
}) {
  const [search, setSearch] = useState(initial);
  return (
    <ItemSearchField
      search={search}
      matched={3}
      onChange={(next) => {
        onChange(next);
        setSearch(next);
      }}
    />
  );
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const input = () => screen.getByRole("textbox", { name: "차트 이름 검색" });

async function type(text: string) {
  await act(async () => {
    input().focus();
  });
  fireEvent.change(input(), { target: { value: text } });
}

const enter = () =>
  act(async () => {
    fireEvent.keyDown(input(), { key: "Enter" });
  });

describe("ItemSearchField", () => {
  it("Enter로 조건을 더하고, 입력을 비우고 포커스를 그대로 둔다", async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    await type(" A1 ");
    await enter();
    expect(onChange).toHaveBeenLastCalledWith([
      { keyword: "A1", match: "contains" },
    ]);
    expect(input()).toHaveProperty("value", "");
    expect(document.activeElement).toBe(input());
    expect(screen.getByText("A1")).toBeTruthy();
    // 맞는 개수를 입력 옆에 적는다.
    expect(screen.getByText("3개")).toBeTruthy();
  });

  it("고른 일치 방식으로 더한다", async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    await type("seoul");
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await enter();
    expect(onChange).toHaveBeenLastCalledWith([
      { keyword: "seoul", match: "startsWith" },
    ]);
  });

  it("같은 조건(대소문자 무시)은 더하지 않고 알린다", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness
        initial={[{ keyword: "Seoul", match: "contains" }]}
        onChange={onChange}
      />,
    );
    await type("SEOUL");
    await enter();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("이미 걸어 둔 조건입니다.")).toBeTruthy();
    // 고칠 수 있게 입력은 그대로 둔다.
    expect(input()).toHaveProperty("value", "SEOUL");
  });

  it("조건이 한도만큼 있으면 더하지 않고 알린다", async () => {
    const onChange = vi.fn();
    const full = Array.from({ length: MAX_SEARCH_CONDS }, (_, i) => ({
      keyword: `k${i}`,
      match: "contains" as const,
    }));
    renderWithI18n(<Harness initial={full} onChange={onChange} />);
    await type("new");
    await enter();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(`조건은 ${MAX_SEARCH_CONDS}개까지 걸 수 있습니다.`),
    ).toBeTruthy();
  });

  it("조건 하나 지우기와 모두 지우기", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness
        initial={[
          { keyword: "a", match: "contains" },
          { keyword: "b", match: "exact" },
        ]}
        onChange={onChange}
      />,
    );
    await act(async () => {
      input().focus();
    });
    fireEvent.click(screen.getByRole("button", { name: '"a" 조건 지우기' }));
    expect(onChange).toHaveBeenLastCalledWith([
      { keyword: "b", match: "exact" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "모두 지우기" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("막으면 입력할 수 없다", () => {
    renderWithI18n(
      <ItemSearchField
        search={[]}
        matched={null}
        disabled
        onChange={() => {}}
      />,
    );
    expect(input()).toHaveProperty("disabled", true);
  });
});
