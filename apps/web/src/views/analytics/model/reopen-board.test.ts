import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it, vi } from "vitest";
import { leaf, split } from "@/entities/workspace/lib/layout-tree";
import { createBoardStore } from "@/entities/workspace/model/board-store";
import type { AnalyticsBoard, ChartDefaults } from "@/shared/api/types";
import { reopenPanels } from "./reopen-board";

vi.mock("@/shared/api/api", () => ({
  api: { cancelJob: () => Promise.resolve(undefined) },
}));

/** 칸 a·b·c(번호 순) 중 a·c가 그린 적 있는 보드 */
function savedBoard(): AnalyticsBoard {
  const base = createBoardStore(CHART_DEFAULTS as ChartDefaults);
  const draft = base
    .getState()
    .panels[base.getState().activePanelId].getState().draft;
  return {
    layout: split("horizontal", [leaf("a"), leaf("b"), leaf("c")]),
    activePanelId: "b",
    panels: [
      // 저장 순서와 상관없이 칸 번호 순으로 다시 연다.
      {
        id: "c",
        draft: { ...draft, dataset: "draft-c" },
        drawn: { spec: { ...draft, dataset: "c" }, restore: {} },
      },
      { id: "b", draft },
      {
        id: "a",
        draft: { ...draft, dataset: "draft-a" },
        drawn: {
          spec: { ...draft, dataset: "a" },
          restore: { k: { shapes: [] } },
        },
      },
    ],
    updatedAt: 0,
  } as AnalyticsBoard;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("보드 다시 열기", () => {
  it("칸 크기를 안 뒤 칸 번호 순으로, 저장한 설정·item 상태로 연다 (고치던 draft는 둔다)", async () => {
    const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
    const reopen = board.getState().hydrate(savedBoard());
    const order: string[] = [];
    const open = vi.fn(async (store, input) => {
      order.push(input.spec.dataset);
      expect(input.keepDraft).toBe(true);
      expect(store.getState().gridArea).toBeDefined();
    });
    const done = reopenPanels(board, reopen, open);

    const { a, c } = board.getState().panels;
    // 크기를 알기 전에는 여는 중으로 보이고 아무것도 보내지 않는다.
    expect(a.getState().opening).toBe(true);
    expect(c.getState().opening).toBe(true);
    // 뒤 칸이 먼저 크기를 알아도 앞 칸을 기다린다.
    c.getState().setGridArea({ width: 400, height: 300 });
    await tick();
    expect(open).not.toHaveBeenCalled();
    a.getState().setGridArea({ width: 400, height: 300 });
    await done;

    expect(order).toEqual(["a", "c"]);
    expect(open.mock.calls[0][1].restore).toEqual({ k: { shapes: [] } });
    expect(a.getState().opening).toBe(false);
    expect(a.getState().draft.dataset).toBe("draft-a");
  });

  it("기다리는 동안 칸이 지워지면 건너뛰고 다음 칸을 연다", async () => {
    const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
    const reopen = board.getState().hydrate(savedBoard());
    const open = vi.fn(async () => {});
    const done = reopenPanels(board, reopen, open);
    const { c } = board.getState().panels;
    c.getState().setGridArea({ width: 400, height: 300 });
    board.getState().removePanel("a");
    await done;
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]).toEqual([
      c,
      expect.objectContaining({
        spec: expect.objectContaining({ dataset: "c" }),
      }),
    ]);
  });

  it("열지 못한 칸은 그 칸에 알리고 여는 중을 푼다", async () => {
    const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
    const reopen = board.getState().hydrate(savedBoard());
    for (const { store } of reopen)
      store.getState().setGridArea({ width: 400, height: 300 });
    const open = vi.fn(async () => {
      throw new Error("boom");
    });
    await reopenPanels(board, reopen, open);
    const { a } = board.getState().panels;
    expect(a.getState().opening).toBe(false);
    expect(a.getState().notices).toHaveLength(1);
    expect(a.getState().notices[0]).toContain("boom");
  });
});
