// @vitest-environment jsdom
// 보드·칸 상태가 바뀔 때 보드와 각 칸 내용(renderPanel 결과)이 다시 그려지는지 센다.
// 칸 내용은 그 칸의 작업 store만 구독하는 색 상자다. 한 칸을 바꿨는데 다른 칸이 다시 그려지면 구독이 깨진 것이다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leaf, panelIdsOf, split } from "@/entities/workspace/lib/layout-tree";
import {
  BoardScope,
  PanelScope,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type { BoardStore } from "@/entities/workspace/model/board-store";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { ChartDefaults } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { AnalyticsBoard } from "./AnalyticsBoard";

vi.mock("@/shared/api/api", () => ({
  api: { cancelJob: () => Promise.resolve(undefined) },
}));

/** 칸 id → 칸 내용이 그려진 횟수 */
const boxes = new Map<string, number>();
/** 보드 아래에서 무엇이든 다시 그려 커밋한 횟수 */
let commits = 0;

/** 칸 내용: 자기 칸의 x만 구독하는 색 상자 */
function ColorBox({ id }: { id: string }) {
  const x = useWorkspace((s) => s.draft.x);
  boxes.set(id, (boxes.get(id) ?? 0) + 1);
  return (
    <div data-testid={`box-${id}`} data-x={x} className="size-full bg-accent" />
  );
}

// view처럼 컴포넌트 밖에서 고정한다.
const renderPanel = (id: string) => (
  <PanelScope panelId={id}>
    <ColorBox id={id} />
  </PanelScope>
);

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

let board: BoardStore;
let ids: string[];

function Capture() {
  board = useBoardStore();
  return null;
}

beforeEach(() => {
  window.PointerEvent ??= TestPointerEvent as unknown as typeof PointerEvent;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 900,
    height: 900,
    right: 900,
    bottom: 900,
    x: 0,
    y: 0,
    toJSON() {},
  });

  renderWithI18n(
    <BoardScope defaults={CHART_DEFAULTS as ChartDefaults}>
      <Capture />
      <Profiler id="board" onRender={() => commits++}>
        <AnalyticsBoard renderPanel={renderPanel} />
      </Profiler>
    </BoardScope>,
  );
  // 3×3
  act(() => board.getState().applyPreset("3x3"));
  ids = board.getState().panelIds;
  act(() => board.getState().activate(ids[0]));
  boxes.clear();
  commits = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** 바꾼 뒤 다시 그려진 칸 내용 (칸 번호 → 횟수) */
const renders = () =>
  Object.fromEntries(
    [...boxes].map(([id, n]) => [board.getState().panelIds.indexOf(id) + 1, n]),
  );

describe("AnalyticsBoard 렌더 횟수", () => {
  it("처음에는 칸 내용을 한 번씩 그린다", () => {
    cleanup();
    boxes.clear();
    renderWithI18n(
      <BoardScope defaults={CHART_DEFAULTS as ChartDefaults}>
        <Capture />
        <AnalyticsBoard renderPanel={renderPanel} />
      </BoardScope>,
    );
    act(() => board.getState().applyPreset("3x3"));
    expect(boxes.size).toBe(9);
    // 처음 칸 1은 preset 전에 한 번 그렸고, 그 뒤 칸 8개만 새로 그린다.
    expect([...boxes.values()]).toEqual(Array(9).fill(1));
  });

  it("다른 칸을 골라도 칸 내용은 다시 그리지 않는다", () => {
    act(() => board.getState().activate(ids[4]));
    fireEvent.pointerDown(screen.getByTestId(`box-${ids[8]}`));
    expect(board.getState().activePanelId).toBe(ids[8]);
    expect(renders()).toEqual({});
  });

  it("한 칸의 draft가 바뀌면 그 칸 내용만 다시 그리고 보드는 그리지 않는다", () => {
    act(() =>
      board.getState().panels[ids[3]].getState().updateDraft({ x: "other" }),
    );
    expect(renders()).toEqual({ 4: 1 });
    expect(commits).toBe(1);
    // 커밋은 칸 4의 색 상자 하나다 (보드·칸 틀은 칸 store를 구독하지 않는다).
    act(() => board.getState().panels[ids[3]].getState().setPage(2));
    expect(renders()).toEqual({ 4: 1 });
    expect(commits).toBe(1);
  });

  it("경계를 끄는 동안에는 아무것도 다시 그리지 않고, 놓을 때 비율만 바꿔 칸 내용은 그대로다", () => {
    // 행 사이(위아래로 미는) 경계
    const separator = screen
      .getAllByRole("separator")
      .find((el) => el.getAttribute("aria-orientation") === "horizontal");
    if (!separator) throw new Error("행 사이 경계가 없습니다");
    fireEvent.pointerDown(separator, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 300,
    });
    for (let i = 1; i <= 20; i++)
      fireEvent.pointerMove(separator, {
        pointerId: 1,
        clientX: 300,
        clientY: 300 + i * 5,
      });
    expect(commits).toBe(0);
    fireEvent.pointerUp(separator, { pointerId: 1 });
    expect(commits).toBeGreaterThan(0);
    expect(renders()).toEqual({});
    // 키보드로 비율을 바꿔도 같다.
    fireEvent.keyDown(separator, { key: "ArrowDown" });
    expect(renders()).toEqual({});
  });

  it("칸을 옮겨도(번호가 바뀌어도) 칸 내용은 다시 그리지 않는다", () => {
    act(() => board.getState().movePanel(ids[0], ids[8], "right"));
    expect(board.getState().panelIds.indexOf(ids[0])).toBe(8);
    expect(renders()).toEqual({});
  });

  it("최대화와 되돌리기에도 칸 내용은 다시 그리지 않는다", () => {
    act(() => board.getState().setMaximized(ids[2]));
    act(() => board.getState().setMaximized(null));
    expect(renders()).toEqual({});
  });

  it("그리는 칸이 생겨 잠겨도 칸 내용은 다시 그리지 않는다", () => {
    act(() => board.getState().setPanelBusy(ids[5], true));
    act(() => board.getState().setPanelBusy(ids[5], false));
    expect(renders()).toEqual({});
  });

  it("칸을 지우면 남은 칸 내용은 다시 그리지 않는다", () => {
    act(() => board.getState().removePanel(ids[4]));
    expect(renders()).toEqual({});
  });

  it("레이아웃이 바뀌어 칸을 다시 마운트하지 않는다", () => {
    const layout = split("horizontal", [
      leaf(ids[0]),
      split("vertical", ids.slice(1).map(leaf)),
    ]);
    const before = screen.getByTestId(`box-${ids[1]}`);
    act(() => board.setState({ layout, panelIds: panelIdsOf(layout) }));
    expect(screen.getByTestId(`box-${ids[1]}`)).toBe(before);
    expect(renders()).toEqual({});
  });
});
