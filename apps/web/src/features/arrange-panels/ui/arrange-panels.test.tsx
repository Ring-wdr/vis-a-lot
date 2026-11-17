// @vitest-environment jsdom
// 보드 도구 줄 버튼: 칸 추가, 레이아웃 preset popover, 보드 비우기. 막힌 이유와 확인 팝업을 본다.

import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presetLayout } from "@/entities/workspace/lib/layout-presets";
import { MAX_PANELS } from "@/entities/workspace/lib/layout-tree";
import {
  BoardScope,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type { BoardStore } from "@/entities/workspace/model/board-store";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import type { ChartDefaults } from "@/shared/api/types";
import { renderWithI18n } from "@/shared/lib/render-with-i18n";
import { AddPanelButton } from "./AddPanelButton";
import { ClearBoardButton } from "./ClearBoardButton";
import { LayoutPresetButton } from "./LayoutPresetButton";

const clearBoard = vi.fn(() => Promise.resolve(undefined));
vi.mock("@/shared/api/api", () => ({
  api: {
    cancelJob: () => Promise.resolve(undefined),
    clearBoard: () => clearBoard(),
  },
}));
const confirm = vi.fn(async (_message: string, _options?: unknown) => true);
vi.mock("@/shared/ui/AlertDialog", () => ({
  showConfirm: (message: string, options?: unknown) =>
    confirm(message, options),
}));

let board: BoardStore;
function Capture() {
  board = useBoardStore();
  return null;
}

const LOCKED =
  "그리는 칸이 있어 레이아웃을 바꿀 수 없습니다. 그리기가 끝나거나 취소한 뒤에 바꿔 주세요.";

const flush = () => act(async () => {});

function draw(panelId: string) {
  const store = board.getState().panels[panelId];
  store.getState().setCurrent({
    chartId: `chart-${panelId}`,
    jobId: `job-${panelId}`,
    historyId: "",
    spec: store.getState().draft,
  } as DrawnChart);
}

beforeEach(() => {
  confirm.mockClear();
  clearBoard.mockClear();
  renderWithI18n(
    <QueryClientProvider client={new QueryClient()}>
      <BoardScope defaults={CHART_DEFAULTS as ChartDefaults}>
        <Capture />
        <AddPanelButton />
        <LayoutPresetButton />
        <ClearBoardButton />
      </BoardScope>
    </QueryClientProvider>,
  );
});

afterEach(cleanup);

const addButton = () => screen.getByRole("button", { name: "칸 추가" });
const layoutButton = () => screen.getByRole("button", { name: "레이아웃" });

describe("칸 추가", () => {
  it("칸을 더하고, 9칸이면 막고 이유를 title로 알린다", () => {
    for (let i = 1; i < MAX_PANELS; i++) fireEvent.click(addButton());
    expect(board.getState().panelIds).toHaveLength(MAX_PANELS);
    expect(addButton()).toHaveProperty("disabled", true);
    expect(addButton().getAttribute("title")).toBe(
      `칸은 ${MAX_PANELS}개까지 둘 수 있습니다.`,
    );
  });

  it("그리는 칸이 있으면 칸 추가·레이아웃을 막고, 보드 비우기는 둔다", () => {
    const [id] = board.getState().panelIds;
    act(() => board.getState().setPanelBusy(id, true));
    expect(addButton()).toHaveProperty("disabled", true);
    expect(addButton().getAttribute("title")).toBe(LOCKED);
    expect(layoutButton()).toHaveProperty("disabled", true);
    expect(layoutButton().getAttribute("title")).toBe(LOCKED);
    expect(screen.getByRole("button", { name: "보드 비우기" })).toHaveProperty(
      "disabled",
      false,
    );
    act(() => board.getState().setPanelBusy(id, false));
    expect(addButton()).toHaveProperty("disabled", false);
  });
});

describe("레이아웃 popover", () => {
  it("preset 17개를 칸 수별로 보이고, 지금 레이아웃과 같은 preset을 눌린 모양으로 둔다", async () => {
    fireEvent.click(addButton());
    fireEvent.click(layoutButton());
    await flush();
    const options = screen.getAllByRole("button", { pressed: false });
    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(options.length + pressed.length).toBe(17);
    // 칸 추가는 세로로 쌓는다: 2×1
    expect(pressed.map((b) => b.getAttribute("aria-label"))).toEqual(["2×1"]);
    expect(screen.getByRole("group", { name: "6칸" })).toBeTruthy();
  });

  it("preset을 고르면 적용하고, 그린 칸이 지워지지 않으면 묻지 않는다", async () => {
    fireEvent.click(layoutButton());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "2×2" }));
    await flush();
    expect(confirm).not.toHaveBeenCalled();
    const ids = board.getState().panelIds;
    expect(ids).toHaveLength(4);
    expect(board.getState().layout).toEqual(presetLayout("2x2", ids));
  });

  it("그린 칸이 지워지면 '마지막 칸 N개'를 확인받고, 취소하면 그대로 둔다", async () => {
    act(() => board.getState().applyPreset("2x2"));
    const ids = board.getState().panelIds;
    act(() => draw(ids[3]));
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(layoutButton());
    await flush();
    fireEvent.click(
      screen.getByRole("button", { name: "왼쪽 큰 칸 + 오른쪽 2칸" }),
    );
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain("마지막 칸 1개가 지워집니다.");
    expect(board.getState().panelIds).toEqual(ids);

    fireEvent.click(layoutButton());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "1×1" }));
    await flush();
    expect(confirm.mock.calls[1][0]).toContain("마지막 칸 3개가 지워집니다.");
    expect(board.getState().panelIds).toEqual([ids[0]]);
  });
});

describe("보드 비우기", () => {
  it("확인 뒤 빈 칸 하나로 되돌리고 저장한 보드도 지운다", async () => {
    act(() => board.getState().applyPreset("2x2"));
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "보드 비우기" }));
    await flush();
    expect(board.getState().panelIds).toHaveLength(4);
    expect(clearBoard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "보드 비우기" }));
    await flush();
    expect(board.getState().panelIds).toHaveLength(1);
    expect(clearBoard).toHaveBeenCalledTimes(1);
  });
});
