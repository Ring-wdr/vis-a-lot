"use client";

// 저장한 보드를 다시 연다. 받은 보드로 보드 store를 채운 뒤(hydrate), 그린 적이 있는 칸을 칸 번호 순으로
// 저장한 설정과 item 상태로 다시 그린다 (history에서 여는 것과 같은 길, openChartIn). PNG 크기는 칸 크기라
// 칸이 화면에 붙어 크기를 잰 뒤에 보낸다. 요청은 한 칸씩 차례로 보내 Render Worker 대기열에 번호 순으로 들어간다.

import { t } from "@lingui/core/macro";
import type {
  BoardStore,
  PanelToReopen,
} from "@/entities/workspace/model/board-store";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { openChartIn } from "@/features/open-chart/model/open-chart";
import "../config/messages";

type OpenChart = typeof openChartIn;

/**
 * 칸 크기를 알 때까지 기다린다. 기다리는 동안 칸이 지워지면(칸 삭제·preset) false로 끝난다.
 */
export function waitForPanelArea(
  board: BoardStore,
  panelId: string,
  store: WorkspaceStore,
) {
  const ready = () => store.getState().gridArea !== undefined;
  const alive = () => board.getState().panels[panelId] === store;
  if (ready()) return Promise.resolve(true);
  if (!alive()) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const done = (value: boolean) => {
      stopPanel();
      stopBoard();
      resolve(value);
    };
    const stopPanel = store.subscribe(() => {
      if (ready()) done(true);
    });
    const stopBoard = board.subscribe(() => {
      if (!alive()) done(false);
    });
  });
}

/**
 * hydrate가 돌려준 칸들을 번호 순으로 다시 그린다. 모든 칸을 먼저 '여는 중'으로 두어 빈 칸 안내 대신 진행 표시를 보이고,
 * 자동 저장이 그 칸을 그린 적 없는 칸으로 보내지 않게 한다. 실패한 칸은 그 칸에 알린다.
 */
export async function reopenPanels(
  board: BoardStore,
  reopen: readonly PanelToReopen[],
  open: OpenChart = openChartIn,
) {
  for (const { store } of reopen) store.setState({ opening: true });
  for (const { panelId, store, drawn } of reopen) {
    try {
      if (!(await waitForPanelArea(board, panelId, store))) continue;
      await open(store, {
        spec: drawn.spec,
        restore: drawn.restore,
        keepDraft: true,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      store.getState().notify(t`저장한 차트를 다시 열지 못했습니다: ${reason}`);
    } finally {
      store.setState({ opening: false });
    }
  }
}
