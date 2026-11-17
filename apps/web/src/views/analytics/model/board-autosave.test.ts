import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoardStore } from "@/entities/workspace/model/board-store";
import type { DrawnChart } from "@/entities/workspace/model/workspace-store";
import type { ChartDefaults } from "@/shared/api/types";
import { AUTOSAVE_DELAY_MS, createBoardAutosave } from "./board-autosave";

vi.mock("@/shared/api/api", () => ({
  api: { cancelJob: () => Promise.resolve(undefined) },
}));

const boardStore = () => {
  const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
  board.getState().hydrate(null);
  return board;
};

const activePanel = (board: ReturnType<typeof boardStore>) =>
  board.getState().panels[board.getState().activePanelId];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("보드 자동 저장", () => {
  it("마지막 변경 뒤 1초에 한 번 보낸다", () => {
    const board = boardStore();
    const save = vi.fn();
    createBoardAutosave(board, save);
    const panel = activePanel(board);

    panel.getState().updateDraft({ x: "a" });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    panel.getState().updateDraft({ y: "b" });
    board.getState().addPanel();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    const body = save.mock.calls[0][0];
    expect(body.panels).toHaveLength(2);
    expect(body.panels[0].draft).toMatchObject({ x: "a", y: "b" });
  });

  it("저장할 것이 아닌 화면 상태(고른 item·모드·칸 크기·그리는 칸)는 보내지 않는다", () => {
    const board = boardStore();
    const save = vi.fn();
    createBoardAutosave(board, save);
    const panel = activePanel(board);
    panel.getState().setSelectedItem("k");
    panel.getState().setGridArea({ width: 10, height: 10 });
    board.getState().setMode("zoom");
    board.getState().setPanelBusy(board.getState().activePanelId, true);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("새로 그리거나 item 다시 그리기가 끝나면 보낸다", () => {
    const board = boardStore();
    const save = vi.fn();
    createBoardAutosave(board, save);
    const panel = activePanel(board);
    panel.getState().setCurrent({
      chartId: "chart",
      jobId: "job",
      historyId: "",
      spec: panel.getState().draft,
    } as DrawnChart);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].panels[0].chartId).toBe("chart");

    // 다시 그리기를 시작할 때는 보내지 않고, 끝나면 보낸다.
    panel.getState().setItemJob("k", "item-job");
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
    panel.getState().setItemJob("k", undefined);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("다시 여는 칸이 있으면 끝날 때까지 미룬다", () => {
    const board = boardStore();
    const save = vi.fn();
    createBoardAutosave(board, save);
    const panel = activePanel(board);
    panel.setState({ opening: true });
    panel.getState().updateDraft({ x: "a" });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
    panel.setState({ opening: false });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("보드를 받아 채우기 전에는 보내지 않는다 (저장한 보드를 빈 보드로 덮지 않는다)", () => {
    const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
    const save = vi.fn();
    createBoardAutosave(board, save);
    activePanel(board).getState().updateDraft({ x: "a" });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it("더한 칸의 변경도 듣고, flush는 기다리던 저장을 바로 보내며 stop 뒤에는 보내지 않는다", () => {
    const board = boardStore();
    const save = vi.fn();
    const autosave = createBoardAutosave(board, save);
    const id = board.getState().addPanel();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    board.getState().panels[id as string].getState().updateDraft({ x: "z" });
    autosave.flush();
    expect(save).toHaveBeenCalledTimes(2);
    autosave.stop();
    board.getState().panels[id as string].getState().updateDraft({ x: "q" });
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
