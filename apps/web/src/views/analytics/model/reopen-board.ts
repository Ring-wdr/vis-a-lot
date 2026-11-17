"use client";

// 저장한 보드를 다시 연다. 받은 보드로 보드 store를 채운 뒤(hydrate), 그린 적이 있는 칸을 칸 번호 순으로
// 저장한 설정과 item 상태로 다시 그린다 (history에서 여는 것과 같은 길, openChartIn). PNG 크기는 칸 크기라
// 칸이 화면에 붙어 크기를 잰 뒤에 보낸다. 요청은 한 칸씩 차례로 보내 Render Worker 대기열에 번호 순으로 들어간다.
// 칸 연결이 있으면 따를 칸을 먼저 그려 선택이 restore로 돌아오게 하고, 그 job이 끝난 뒤 따르는 칸을
// POST /charts의 link로 함께 걸어 연다 (따르는 칸을 범위 없이 한 번, 범위로 또 한 번 그리지 않는다).

import { t } from "@lingui/core/macro";
import type {
  BoardStore,
  PanelToReopen,
} from "@/entities/workspace/model/board-store";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { openChartIn } from "@/features/open-chart/model/open-chart";
import type { AnalyticsPanelLink } from "@/shared/api/types";
import "../config/messages";

type OpenChart = typeof openChartIn;

/** 보드 store가 바뀔 때마다 확인해, 조건이 맞으면 true, 칸이 지워지면 false로 끝난다. */
function waitFor(
  board: BoardStore,
  panelId: string,
  store: WorkspaceStore,
  ready: () => boolean,
) {
  const alive = () => board.getState().panels[panelId] === store;
  if (!alive()) return Promise.resolve(false);
  if (ready()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const done = (value: boolean) => {
      stopPanel();
      stopBoard();
      resolve(value);
    };
    const check = () => {
      if (!alive()) done(false);
      else if (ready()) done(true);
    };
    const stopPanel = store.subscribe(check);
    const stopBoard = board.subscribe(check);
  });
}

/**
 * 칸 크기를 알 때까지 기다린다. 기다리는 동안 칸이 지워지면(칸 삭제·preset) false로 끝난다.
 */
export function waitForPanelArea(
  board: BoardStore,
  panelId: string,
  store: WorkspaceStore,
) {
  return waitFor(
    board,
    panelId,
    store,
    () => store.getState().gridArea !== undefined,
  );
}

/**
 * 칸이 다 그릴 때까지 기다린다(여는 중도, 그리는 중도 아니다). 그리는 중인지는 칸 job 상태를 옮겨 둔 보드의 busy로 본다.
 * 칸이 지워지면 false로 끝난다.
 */
export function waitForPanelSettled(
  board: BoardStore,
  panelId: string,
  store: WorkspaceStore,
) {
  return waitFor(
    board,
    panelId,
    store,
    () => !store.getState().opening && !board.getState().busy[panelId],
  );
}

/**
 * 다시 열 순서: 칸 번호 순을 따르되, 따를 칸이 다시 여는 칸이면 그 칸을 먼저 둔다.
 * 서로 따르면(1 ↔ 2) 먼저 만난 쪽에서 끊는다. 그렇게 끊긴 쪽은 연결 전파가 나중에 범위를 건다.
 */
export function reopenOrder(
  reopen: readonly PanelToReopen[],
  links: Record<string, AnalyticsPanelLink>,
) {
  const byId = new Map(reopen.map((p) => [p.panelId, p]));
  const order: PanelToReopen[] = [];
  const seen = new Set<string>();
  const visit = (entry: PanelToReopen) => {
    if (seen.has(entry.panelId)) return;
    seen.add(entry.panelId);
    const source = byId.get(links[entry.panelId]?.follow ?? "");
    if (source) visit(source);
    order.push(entry);
  };
  for (const entry of reopen) visit(entry);
  return order;
}

/**
 * hydrate가 돌려준 칸들을 다시 그린다. 모든 칸을 먼저 '여는 중'으로 두어 빈 칸 안내 대신 진행 표시를 보이고,
 * 자동 저장이 그 칸을 그린 적 없는 칸으로 보내지 않게 한다. 실패한 칸은 그 칸에 알린다.
 * 따를 칸이 앞에서 다시 연 칸이면 그 칸이 다 그린 뒤로 미뤄, 연결을 그릴 때 함께 건다. 다른 칸은 기다리지 않는다.
 */
export async function reopenPanels(
  board: BoardStore,
  reopen: readonly PanelToReopen[],
  open: OpenChart = openChartIn,
) {
  for (const { store } of reopen) store.setState({ opening: true });
  const { links } = board.getState();
  const order = reopenOrder(reopen, links);

  const openPanel = async ({ panelId, store, drawn }: PanelToReopen) => {
    try {
      if (!(await waitForPanelArea(board, panelId, store))) return;
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
  };

  // 앞에서 다시 연(또는 미룬) 칸을 따르는 칸은 미룬다.
  const earlier = new Set<string>();
  const deferred: { entry: PanelToReopen; follow: string }[] = [];
  for (const entry of order) {
    const follow = links[entry.panelId]?.follow;
    earlier.add(entry.panelId);
    if (follow && follow !== entry.panelId && earlier.has(follow))
      deferred.push({ entry, follow });
    else await openPanel(entry);
  }
  for (const { entry, follow } of deferred) {
    const source = board.getState().panels[follow];
    // 따를 칸이 다 그리면 연다. 그사이 따를 칸이 지워졌으면 연결 없이 연다.
    if (source) await waitForPanelSettled(board, follow, source);
    await openPanel(entry);
  }
}
