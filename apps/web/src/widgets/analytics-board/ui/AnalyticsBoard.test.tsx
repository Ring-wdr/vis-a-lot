// @vitest-environment jsdom
// 보드 위젯을 차트 없이 색 상자(renderPanel)로 그려 칸 배치·재배치·크기 조절·최대화·잠금·좁은 화면을 본다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  leaf,
  MIN_RATIO,
  panelIdsOf,
  RATIO_STEP,
  split,
} from "@/entities/workspace/lib/layout-tree";
import {
  BoardScope,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type { BoardStore } from "@/entities/workspace/model/board-store";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import type { ChartDefaults } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { sizesHeld } from "@/shared/lib/size-hold";
import { AnalyticsBoard } from "./AnalyticsBoard";

vi.mock("@/shared/api/api", () => ({
  api: { cancelJob: () => Promise.resolve(undefined) },
}));
const confirm = vi.fn(async (_message: string, _options?: unknown) => true);
vi.mock("@/shared/ui/AlertDialog", () => ({
  showConfirm: (message: string, options?: unknown) =>
    confirm(message, options),
}));

/** 칸 안에 끼우는 색 상자 */
const renderPanel = (id: string) => (
  <div data-testid={`box-${id}`} className="size-full bg-accent" />
);

let wide = true;
let board: BoardStore;

function Capture() {
  board = useBoardStore();
  return null;
}

/** 칸 셋: a | (b / c) */
function setup() {
  renderWithI18n(
    <BoardScope defaults={CHART_DEFAULTS as ChartDefaults}>
      <Capture />
      <AnalyticsBoard renderPanel={renderPanel} />
    </BoardScope>,
  );
  act(() => {
    board.getState().addPanel();
    board.getState().addPanel();
    const [a, b, c] = board.getState().panelIds;
    const layout = split("horizontal", [
      leaf(a),
      split("vertical", [leaf(b), leaf(c)]),
    ]);
    board.setState({ layout, panelIds: panelIdsOf(layout) });
    board.getState().activate(a);
  });
  const [a, b, c] = board.getState().panelIds;
  return { a, b, c };
}

const cell = (id: string) =>
  document.querySelector<HTMLElement>(`[data-panel-id="${id}"]`);
const panel = (n: number) => screen.getByRole("region", { name: `칸 ${n}` });

function draw(panelId: string) {
  const store = board.getState().panels[panelId];
  store.getState().setCurrent({
    chartId: `chart-${panelId}`,
    jobId: `job-${panelId}`,
    historyId: "",
    spec: store.getState().draft,
  } as DrawnChart);
}

/** jsdom에는 PointerEvent가 없다. 경계 끌기에 쓰는 값(좌표, pointerId)만 담는다. */
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  window.PointerEvent ??= TestPointerEvent as unknown as typeof PointerEvent;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  wide = true;
  confirm.mockClear();
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  // 칸을 감싸는 판은 1000×600이다 (jsdom은 크기를 재지 않는다).
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 1000,
    height: 600,
    right: 1000,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnalyticsBoard", () => {
  it("레이아웃 트리의 자리에 칸을 번호 순으로 놓고 칸마다 renderPanel을 끼운다", () => {
    const { a, b, c } = setup();
    expect(board.getState().layout).toEqual(
      split(
        "horizontal",
        [leaf(a), split("vertical", [leaf(b), leaf(c)])],
        [0.5, 0.5],
      ),
    );
    expect(cell(a)?.style).toMatchObject({
      left: "0%",
      top: "0%",
      width: "50%",
      height: "100%",
    });
    expect(cell(b)?.style).toMatchObject({
      left: "50%",
      top: "0%",
      width: "50%",
      height: "50%",
    });
    expect(cell(c)?.style).toMatchObject({
      left: "50%",
      top: "50%",
      width: "50%",
      height: "50%",
    });
    for (const [n, id] of [a, b, c].entries())
      expect(within(panel(n + 1)).getByTestId(`box-${id}`)).toBeTruthy();
    // 경계는 둘: a | 오른쪽, b / c
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  it("칸을 누르거나 칸 안에 포커스가 들어오면 그 칸을 고른다", () => {
    const { a, b, c } = setup();
    expect(panel(1).getAttribute("aria-current")).toBe("true");
    fireEvent.pointerDown(screen.getByTestId(`box-${b}`));
    expect(board.getState().activePanelId).toBe(b);
    expect(panel(2).getAttribute("aria-current")).toBe("true");
    expect(panel(1).getAttribute("aria-current")).toBeNull();
    fireEvent.focus(
      within(panel(3)).getByRole("button", { name: "칸 3 지우기" }),
    );
    expect(board.getState().activePanelId).toBe(c);
    expect(a).toBeTruthy();
  });

  it("칸을 옮겨도 칸 내용을 다시 마운트하지 않는다", () => {
    const { a, b } = setup();
    const box = screen.getByTestId(`box-${a}`);
    act(() => board.getState().movePanel(a, b, "right"));
    expect(screen.getByTestId(`box-${a}`)).toBe(box);
    // 번호가 바뀐다: b가 1, a가 2
    expect(within(panel(2)).getByTestId(`box-${a}`)).toBe(box);
  });

  it("키보드로 손잡이를 집어 다른 칸의 변에 놓는다", async () => {
    const { a, b, c } = setup();
    // dnd-kit이 재는 자리: 칸은 data-panel-id의 자리, 손잡이는 그 칸 왼쪽 위의 20×20
    const boxes: Record<string, [number, number, number, number]> = {
      [a]: [0, 0, 500, 600],
      [b]: [500, 0, 500, 300],
      [c]: [500, 300, 500, 300],
    };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const id =
          this.closest<HTMLElement>("[data-panel-id]")?.dataset.panelId;
        const [left, top, width, height] =
          id && boxes[id]
            ? this.hasAttribute("data-drag-handle")
              ? [boxes[id][0] + 4, boxes[id][1] + 4, 20, 20]
              : boxes[id]
            : [0, 0, 1000, 600];
        return {
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          x: left,
          y: top,
          toJSON() {},
        };
      },
    );
    const handle = screen.getByRole("button", { name: "칸 1 옮기기" });
    const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await tick();
    // → : 칸 2(b)의 왼쪽 변, ↓ : 칸 2의 아래 변
    fireEvent.keyDown(document, { code: "ArrowRight", key: "ArrowRight" });
    await tick();
    fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
    await tick();
    // 끄는 동안 놓을 변과 바뀔 레이아웃을 미리 보인다.
    expect(document.querySelector("[data-moved]")).toBeTruthy();
    fireEvent.keyDown(document, { code: "Space", key: " " });
    await tick();
    // a를 빼면 b / c, b의 아래에 넣어 b의 몫을 나눈다: b / a / c
    expect(board.getState().layout).toEqual(
      split("vertical", [leaf(b), leaf(a), leaf(c)], [0.25, 0.25, 0.5]),
    );
    expect(document.querySelector("[data-moved]")).toBeNull();
  });

  it("경계를 끄는 동안 DOM의 칸 자리만 바꾸고, 놓을 때 비율을 한 번 쓴다", () => {
    const { a, b } = setup();
    // store에 레이아웃을 쓴 횟수
    const resize = vi.fn();
    board.subscribe((s, prev) => {
      if (s.layout !== prev.layout) resize();
    });
    const before = board.getState().layout;
    const [outer] = screen.getAllByRole("separator");
    fireEvent.pointerDown(outer, {
      button: 0,
      pointerId: 1,
      clientX: 500,
      clientY: 0,
    });
    fireEvent.pointerMove(outer, { pointerId: 1, clientX: 300, clientY: 0 });
    // 판 폭 1000에서 200 왼쪽으로: 0.5 → 0.3
    expect(cell(a)?.style.width).toBe("30%");
    expect(cell(b)?.style.left).toBe("30%");
    expect(outer.style.left).toBe("30%");
    expect(board.getState().layout).toBe(before);
    expect(resize).not.toHaveBeenCalled();
    // 끄는 동안 칸은 새 크기를 쓰지 않고 기다린다 (손을 멈춰도 다시 그리지 않는다).
    expect(sizesHeld()).toBe(true);
    fireEvent.pointerUp(outer, { pointerId: 1 });
    expect(resize).toHaveBeenCalledTimes(1);
    expect(sizesHeld()).toBe(false);
    const layout = board.getState().layout;
    expect(layout.type === "split" && layout.ratios[0]).toBeCloseTo(0.3);
    expect(cell(a)?.style.width).toBe("30%");
  });

  it("경계는 최소 비율보다 줄지 않고, 화살표 키로 RATIO_STEP씩 옮긴다", () => {
    const { a } = setup();
    const [outer] = screen.getAllByRole("separator");
    const ratio = () => {
      const l = board.getState().layout;
      return l.type === "split" ? l.ratios[0] : Number.NaN;
    };
    fireEvent.keyDown(outer, { key: "ArrowRight" });
    expect(ratio()).toBeCloseTo(0.5 + RATIO_STEP);
    fireEvent.keyDown(outer, { key: "ArrowLeft" });
    fireEvent.keyDown(outer, { key: "ArrowLeft" });
    expect(ratio()).toBeCloseTo(0.5 - RATIO_STEP);
    // 가로 경계는 위아래 화살표를 쓰지 않는다.
    fireEvent.keyDown(outer, { key: "ArrowDown" });
    expect(ratio()).toBeCloseTo(0.5 - RATIO_STEP);
    fireEvent.keyDown(outer, { key: "Home" });
    expect(ratio()).toBeCloseTo(MIN_RATIO);
    fireEvent.pointerDown(outer, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 0,
    });
    fireEvent.pointerMove(outer, { pointerId: 1, clientX: 2000, clientY: 0 });
    fireEvent.pointerUp(outer, { pointerId: 1 });
    expect(ratio()).toBeCloseTo(1 - MIN_RATIO);
    expect(cell(a)?.style.width).toBe("95%");
    expect(outer.getAttribute("aria-valuenow")).toBe("95");
  });

  it("최대화하면 그 칸만 보드 전체에 보이고, 다른 칸은 자리를 지킨 채 감춘다. Esc로 돌아온다", () => {
    const { a, b } = setup();
    fireEvent.click(
      within(panel(2)).getByRole("button", { name: "칸 최대화" }),
    );
    expect(board.getState().maximizedPanelId).toBe(b);
    expect(cell(b)?.style).toMatchObject({
      left: "0%",
      top: "0%",
      width: "100%",
      height: "100%",
    });
    expect(cell(a)?.style.width).toBe("50%");
    expect(cell(a)?.hasAttribute("inert")).toBe(true);
    expect(cell(a)?.className).toContain("invisible");
    // 최대화한 동안은 옮기기·크기 조절을 숨긴다.
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /옮기기$/ })).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(board.getState().maximizedPanelId).toBeNull();
    expect(cell(b)?.style.width).toBe("50%");
    // 칸을 더블 클릭해도 최대화한다 (버튼 위는 그 버튼의 조작이다).
    fireEvent.doubleClick(screen.getByTestId(`box-${a}`));
    expect(board.getState().maximizedPanelId).toBe(a);
    fireEvent.doubleClick(screen.getByTestId(`box-${a}`));
    expect(board.getState().maximizedPanelId).toBeNull();
  });

  it("칸 닫기: 그린 칸이면 확인을 받고, 마지막 칸은 지울 수 없다", async () => {
    const { a, b, c } = setup();
    await act(async () => {
      fireEvent.click(
        within(panel(3)).getByRole("button", { name: "칸 3 지우기" }),
      );
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(board.getState().panelIds).toEqual([a, b]);

    act(() => draw(b));
    confirm.mockResolvedValueOnce(false);
    await act(async () => {
      fireEvent.click(
        within(panel(2)).getByRole("button", { name: "칸 2 지우기" }),
      );
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("칸 2");
    expect(board.getState().panelIds).toEqual([a, b]);
    await act(async () => {
      fireEvent.click(
        within(panel(2)).getByRole("button", { name: "칸 2 지우기" }),
      );
    });
    expect(board.getState().panelIds).toEqual([a]);

    const last = within(panel(1)).getByRole("button", { name: "칸 1 지우기" });
    expect(last).toHaveProperty("disabled", true);
    expect(last.getAttribute("title")).toBe("마지막 칸은 지울 수 없습니다.");
    expect(c).toBeTruthy();
  });

  it("그리는 칸이 있으면 옮기기·크기 조절·닫기를 막고 이유를 title로 알린다", () => {
    const { a, b } = setup();
    act(() => board.getState().setPanelBusy(b, true));
    const reason =
      "그리는 칸이 있어 레이아웃을 바꿀 수 없습니다. 그리기가 끝나거나 취소한 뒤에 바꿔 주세요.";
    for (const separator of screen.getAllByRole("separator")) {
      expect(separator.getAttribute("aria-disabled")).toBe("true");
      expect(separator.getAttribute("title")).toBe(reason);
    }
    const handle = screen.getByRole("button", { name: "칸 1 옮기기" });
    expect(handle.getAttribute("aria-disabled")).toBe("true");
    expect(handle.getAttribute("title")).toBe(reason);
    const close = within(panel(1)).getByRole("button", { name: "칸 1 지우기" });
    expect(close).toHaveProperty("disabled", true);
    expect(close.getAttribute("title")).toBe(reason);

    // 끌기·키보드도 받지 않는다.
    const before = board.getState().layout;
    const [outer] = screen.getAllByRole("separator");
    fireEvent.keyDown(outer, { key: "ArrowRight" });
    fireEvent.pointerDown(outer, {
      button: 0,
      pointerId: 1,
      clientX: 500,
      clientY: 0,
    });
    fireEvent.pointerMove(outer, { pointerId: 1, clientX: 300, clientY: 0 });
    fireEvent.pointerUp(outer, { pointerId: 1 });
    expect(board.getState().layout).toBe(before);
    expect(cell(a)?.style.width).toBe("50%");

    act(() => board.getState().setPanelBusy(b, false));
    expect(close).toHaveProperty("disabled", false);
    expect(handle.getAttribute("aria-disabled")).toBeNull();
  });

  it("48rem보다 좁으면 트리 없이 번호 순으로 쌓고 옮기기·크기 조절·최대화를 숨긴다", () => {
    wide = false;
    const { a, b, c } = setup();
    const layout = board.getState().layout;
    for (const id of [a, b, c]) {
      expect(cell(id)?.getAttribute("style")).toBeNull();
      expect(cell(id)?.className).toContain("aspect-4/3");
    }
    const order = [...document.querySelectorAll("[data-panel-id]")].map(
      (el) => (el as HTMLElement).dataset.panelId,
    );
    expect(order).toEqual([a, b, c]);
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /옮기기$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "칸 최대화" })).toBeNull();
    // 칸 삭제는 남는다. 저장된 트리는 건드리지 않는다.
    expect(
      within(panel(2)).getByRole("button", { name: "칸 2 지우기" }),
    ).toBeTruthy();
    expect(board.getState().layout).toBe(layout);
  });
});
