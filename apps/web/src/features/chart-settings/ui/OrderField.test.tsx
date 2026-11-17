// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderSort } from "@/entities/chart/model/chart-options";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { OrderField } from "./OrderField";

const ROW = 28;

// jsdom은 크기를 재지 못하므로 가상 스크롤은 모든 줄을 28px 간격으로 그린다고 본다.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * ROW,
      })),
    getTotalSize: () => count * ROW,
    scrollToIndex: () => {},
  }),
}));

const NONE: string[] = [];

/** 바뀐 순서를 그대로 다시 넘기는 컨테이너 대역 */
function Harness({
  values,
  initial = NONE,
  sort = "default",
  onChange,
}: {
  values: string[];
  initial?: string[];
  sort?: OrderSort;
  onChange: (order: string[]) => void;
}) {
  const [order, setOrder] = useState(initial);
  return (
    <OrderField
      label="순서"
      values={values}
      value={order}
      sort={sort}
      onChange={(next) => {
        onChange(next);
        setOrder(next);
      }}
    />
  );
}

/** 줄마다 늘어놓은 값 (순번 표시는 빼고) */
const rows = () =>
  screen
    .getAllByRole("listitem")
    .map((li) => li.querySelector("button > span")?.textContent);

/** jsdom에는 PointerEvent가 없어 dnd-kit의 PointerSensor가 읽는 값(isPrimary·button)을 실어 보낸다. */
class TestPointerEvent extends MouseEvent {
  isPrimary: boolean;
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? false;
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", globalThis.PointerEvent ?? TestPointerEvent);
  // 줄 자리(data-index)로 크기를 돌려준다. dnd-kit이 끄는 자리를 이것으로 판정한다.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const index = Number((this as HTMLElement).dataset?.index ?? -1);
      const top = index >= 0 ? index * ROW : 0;
      const height = index >= 0 ? ROW : 600;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        width: 200,
        height,
        right: 200,
        bottom: top + height,
        toJSON() {},
      } as DOMRect;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OrderField", () => {
  it("저장한 값을 앞에, 나머지를 정렬 순으로 늘어놓는다", () => {
    renderWithI18n(
      <Harness
        values={["L2", "L10", "L1"]}
        initial={["L10"]}
        sort="natural"
        onChange={() => {}}
      />,
    );
    expect(rows()).toEqual(["L10", "L1", "L2"]);
  });

  it("Alt+↓로 한 칸 옮기면 맨 위부터 옮긴 값까지를 순서로 넘기고 포커스를 따라간다", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness values={["a", "b", "c", "d"]} onChange={onChange} />,
    );
    const a = screen.getByRole("button", { name: /^a,/ });
    await act(async () => {
      a.focus();
      fireEvent.keyDown(a, { key: "ArrowDown", altKey: true });
    });
    expect(onChange).toHaveBeenLastCalledWith(["b", "a"]);
    expect(rows()).toEqual(["b", "a", "c", "d"]);
    // 다시 그린 뒤에도 옮긴 값에 포커스가 있다.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(document.activeElement?.textContent).toMatch(/^a/);
    // Alt 없는 화살표는 옮기지 않는다.
    fireEvent.keyDown(a, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("Alt+↑로 저장한 값 위로 옮기면 앞서 정한 순서를 지킨다", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness
        values={["a", "b", "c", "d"]}
        initial={["c", "a"]}
        onChange={onChange}
      />,
    );
    expect(rows()).toEqual(["c", "a", "b", "d"]);
    const d = screen.getByRole("button", { name: /^d,/ });
    await act(async () => {
      fireEvent.keyDown(d, { key: "ArrowUp", altKey: true });
    });
    // d가 b 위로 → 맨 위부터 d까지
    expect(onChange).toHaveBeenLastCalledWith(["c", "a", "d"]);
  });

  it("끌어서 놓은 자리로 옮긴다", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness values={["a", "b", "c", "d"]} onChange={onChange} />,
    );
    const d = screen.getByRole("button", { name: /^d,/ });
    await act(async () => {
      fireEvent.pointerDown(d, {
        button: 0,
        isPrimary: true,
        clientX: 10,
        clientY: 3 * ROW + 10,
      });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientX: 10, clientY: 3 * ROW });
      fireEvent.pointerMove(document, { clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.pointerUp(document, { clientX: 10, clientY: 10 });
    });
    // dnd-kit은 놓은 뒤 50ms 동안 click을 막는다. 다음 테스트의 click이 막히지 않게 기다린다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(onChange).toHaveBeenLastCalledWith(["d"]);
  });

  it("처음 순서로는 빈 목록을 넘기고, 저장한 순서가 없으면 보이지 않는다", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <Harness values={["a", "b"]} initial={["b"]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "처음 순서로" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(rows()).toEqual(["a", "b"]);
    expect(screen.queryByRole("button", { name: "처음 순서로" })).toBeNull();
  });

  it("값이 너무 많으면 목록 대신 안내를 보인다", () => {
    renderWithI18n(
      <OrderField
        label="범주 순서"
        values={["a"]}
        value={[]}
        sort="default"
        tooMany
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/값이 너무 많아/)).toBeTruthy();
  });
});
