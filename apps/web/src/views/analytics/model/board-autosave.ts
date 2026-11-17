"use client";

// 보드 자동 저장. 레이아웃·칸 구성·활성 칸·연결·칸 draft가 바뀌거나, 칸이 새로 그리거나 item 다시 그리기가 끝나면
// 마지막 변경 뒤 1초에 한 번 PUT /analytics/board를 보낸다. 보드를 서버에서 받아 채우기 전에는 보내지 않는다
// (빈 보드가 저장한 보드를 덮는다). 다시 여는 칸이 있으면 끝날 때까지 미룬다: 그린 차트 id(chartId) 없이 보내면
// 서버가 그 칸을 그린 적 없는 칸으로 저장한다.

import {
  type BoardState,
  type BoardStore,
  boardSaveBody,
} from "@/entities/workspace/model/board-store";
import type {
  WorkspaceState,
  WorkspaceStore,
} from "@/entities/workspace/model/workspace-store";
import type { SaveAnalyticsBoardRequest } from "@/shared/api/types";

export const AUTOSAVE_DELAY_MS = 1000;

/** 저장할 것이 바뀌었는지 (보드) */
function boardChanged(s: BoardState, prev: BoardState) {
  return (
    s.layout !== prev.layout ||
    s.panelIds !== prev.panelIds ||
    s.activePanelId !== prev.activePanelId ||
    s.links !== prev.links
  );
}

/** item 다시 그리기 job이 하나라도 끝났는지 */
function itemJobFinished(
  next: WorkspaceState["itemJobs"],
  prev: WorkspaceState["itemJobs"],
) {
  if (next === prev) return false;
  return Object.keys(prev).some((key) => next[key] !== prev[key]);
}

/** 저장할 것이 바뀌었는지 (칸): draft, 그린 차트, 끝난 item 다시 그리기 */
function panelChanged(s: WorkspaceState, prev: WorkspaceState) {
  return (
    s.draft !== prev.draft ||
    s.current?.chartId !== prev.current?.chartId ||
    itemJobFinished(s.itemJobs, prev.itemJobs)
  );
}

/**
 * 보드와 모든 칸 store의 저장할 변경을 듣는다. 칸이 더해지거나 지워지면 칸 구독도 다시 건다.
 * 그리는 동안의 진행률·고른 item·모드·칸 크기 같은 화면 상태는 저장하지 않으므로 알리지 않는다.
 */
export function watchBoard(board: BoardStore, onChange: () => void) {
  const panelSubs = new Map<WorkspaceStore, () => void>();
  const syncPanels = (panels: BoardState["panels"]) => {
    const alive = new Set(Object.values(panels));
    for (const [store, stop] of panelSubs)
      if (!alive.has(store)) {
        stop();
        panelSubs.delete(store);
      }
    for (const store of alive)
      if (!panelSubs.has(store))
        panelSubs.set(
          store,
          store.subscribe((s, prev) => {
            if (panelChanged(s, prev)) onChange();
          }),
        );
  };
  syncPanels(board.getState().panels);
  const stopBoard = board.subscribe((s, prev) => {
    if (s.panels !== prev.panels) syncPanels(s.panels);
    if (boardChanged(s, prev)) onChange();
  });
  return () => {
    stopBoard();
    for (const stop of panelSubs.values()) stop();
    panelSubs.clear();
  };
}

/** 다시 여는(opening) 칸이 있는지 */
function anyOpening(s: BoardState) {
  return s.panelIds.some((id) => s.panels[id].getState().opening);
}

/**
 * 자동 저장을 건다. stop은 구독과 대기 중인 저장을 버리고, flush는 대기 중인 저장을 바로 보낸다
 * (화면을 떠날 때). 보내는 일(save)은 react-query mutation을 넘긴다.
 */
export function createBoardAutosave(
  board: BoardStore,
  save: (body: SaveAnalyticsBoardRequest) => void,
  delay = AUTOSAVE_DELAY_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const send = () => {
    timer = undefined;
    const s = board.getState();
    if (!s.hydrated) return;
    if (anyOpening(s)) {
      schedule();
      return;
    }
    save(boardSaveBody(s));
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(send, delay);
  };
  const unwatch = watchBoard(board, schedule);
  return {
    stop: () => {
      unwatch();
      clearTimeout(timer);
      timer = undefined;
    },
    flush: () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      // 다시 여는 칸이 있으면 지금 보내지 않는다 (그 칸이 그린 적 없는 칸으로 저장된다).
      const s = board.getState();
      timer = undefined;
      if (s.hydrated && !anyOpening(s)) save(boardSaveBody(s));
    },
  };
}
