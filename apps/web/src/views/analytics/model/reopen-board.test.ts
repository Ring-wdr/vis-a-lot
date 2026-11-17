import { CHART_DEFAULTS } from "@server/charts/chart-defaults";
import { describe, expect, it, vi } from "vitest";
import { leaf, split } from "@/entities/workspace/lib/layout-tree";
import { createBoardStore } from "@/entities/workspace/model/board-store";
import type { AnalyticsBoard, ChartDefaults } from "@/shared/api/types";
import { reopenOrder, reopenPanels } from "./reopen-board";

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

  describe("칸 연결", () => {
    /** 칸 a·b·c가 모두 그린 적 있고, links대로 따른다. */
    function linkedBoard(links: Record<string, string>) {
      const saved = savedBoard();
      saved.panels = saved.panels.map((p) => ({
        ...p,
        drawn: p.drawn ?? { spec: { ...p.draft, dataset: "b" }, restore: {} },
        ...(links[p.id]
          ? { link: { follow: links[p.id], mode: "filter" as const } }
          : {}),
      }));
      const board = createBoardStore(CHART_DEFAULTS as ChartDefaults);
      const reopen = board.getState().hydrate(saved);
      for (const { store } of reopen)
        store.getState().setGridArea({ width: 400, height: 300 });
      return { board, reopen };
    }

    it("순서: 따를 칸을 먼저 둔다. 서로 따르면 먼저 만난 쪽에서 끊는다", () => {
      const chain = linkedBoard({ a: "b", b: "c" });
      expect(
        reopenOrder(chain.reopen, chain.board.getState().links).map(
          (p) => p.panelId,
        ),
      ).toEqual(["c", "b", "a"]);
      const mutual = linkedBoard({ a: "b", b: "a" });
      expect(
        reopenOrder(mutual.reopen, mutual.board.getState().links).map(
          (p) => p.panelId,
        ),
      ).toEqual(["b", "a", "c"]);
    });

    it("따르는 칸은 따를 칸이 다 그린 뒤에 연다. 관계없는 칸은 기다리지 않는다", async () => {
      const { board, reopen } = linkedBoard({ a: "b" });
      const order: string[] = [];
      const open = vi.fn(async (store) => {
        const id = Object.entries(board.getState().panels).find(
          ([, s]) => s === store,
        )?.[0] as string;
        order.push(id);
        // 칸 job 상태를 옮기는 컴포넌트처럼: 그린 칸은 job이 끝날 때까지 그리는 중이다.
        board.getState().setPanelBusy(id, true);
      });
      const done = reopenPanels(board, reopen, open);
      await tick();
      // b(따를 칸)와 c(관계없음)는 바로 열고, a는 b가 다 그릴 때까지 기다린다.
      expect(order).toEqual(["b", "c"]);
      board.getState().setPanelBusy("c", false);
      await tick();
      expect(order).toEqual(["b", "c"]);
      board.getState().setPanelBusy("b", false);
      await done;
      expect(order).toEqual(["b", "c", "a"]);
    });

    it("기다리는 사이 따를 칸이 지워지면 연결 없이 연다", async () => {
      const { board, reopen } = linkedBoard({ a: "b" });
      const open = vi.fn(async (store) => {
        if (store === board.getState().panels.b)
          board.getState().setPanelBusy("b", true);
      });
      const done = reopenPanels(board, reopen, open);
      await tick();
      expect(open).toHaveBeenCalledTimes(2);
      board.getState().setPanelBusy("b", false);
      board.getState().removePanel("b");
      await done;
      expect(open).toHaveBeenCalledTimes(3);
      expect(board.getState().links).toEqual({});
    });
  });
});
