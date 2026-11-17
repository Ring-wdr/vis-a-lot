"use client";

// 칸 연결 전파. 따를 칸의 범위가 바뀌었을 수 있으면(선택·지우기·legend 체크·개별 속성 같은 item 조작이 끝났거나,
// 새로 그렸다) 그 칸을 따르는 칸마다 PUT /charts/{chartId}/link를 보낸다. 연결을 바꾸거나 풀어도 보낸다.
// 서버는 따를 칸의 지금 행 범위를 고정해 걸고 따르는 칸을 다시 그린다(범위가 그대로면 그리지 않는다).
// - 확대·이동·크기·색·도형·즐겨찾기처럼 범위를 바꾸지 않는 다시 그리기(lookJobs)가 끝나면 보내지 않는다.
// - 따르는 칸이나 따를 칸이 그리는 중이면(409) 끝나기를 기다렸다가 보낸다. 기다리는 동안 여러 번 바뀌어도
//   보낼 때의 상태로 만든 마지막 요청 하나만 간다.
// - 전파는 한 단계다: 연결 때문에 다시 그린 칸(연결 job)이 끝나도 그 칸을 따르는 칸에는 보내지 않는다.
// - 그린 적 없는 칸에는 보내지 않는다. 그 칸을 그릴 때 POST /charts의 link로 함께 건다.

import { PANEL_ITEM_KEY } from "@/entities/workspace/lib/panel-link";
import {
  type BoardState,
  type BoardStore,
  linkRequestOf,
} from "@/entities/workspace/model/board-store";
import type {
  WorkspaceState,
  WorkspaceStore,
} from "@/entities/workspace/model/workspace-store";
import { ApiRequestError, api } from "@/shared/api/api";
import type { ChartLinkRequest } from "@/shared/api/types";

export type SetLinkRequest = (
  chartId: string,
  link: ChartLinkRequest | null,
) => Promise<{ jobId: string | null }>;

/** 칸이 쉬고 있는지: 여는 중도, 그리는 중도, item을 다시 그리는 중도 아니다. */
function settled(s: BoardState, id: string) {
  const p = s.panels[id]?.getState();
  if (!p) return false;
  return !p.opening && !s.busy[id] && Object.keys(p.itemJobs).length === 0;
}

/**
 * item 다시 그리기가 새로 시작됐으면 그 job id들. 그린 행의 범위를 바꾸지 않는 것(확대·크기·색·도형, lookJobs)은 뺀다.
 * 그 다시 그리기가 끝나도 따르는 칸에 보낼 것이 없다.
 */
function startedJobs(next: WorkspaceState, prev: WorkspaceState) {
  if (next.itemJobs === prev.itemJobs) return [];
  return Object.entries(next.itemJobs)
    .filter(([key, jobId]) => prev.itemJobs[key] !== jobId)
    .map(([, jobId]) => jobId)
    .filter((jobId) => !next.lookJobs[jobId]);
}

/**
 * 보드의 연결 전파를 건다. 보드와 칸 store를 구독하고 그리지 않는다. stop으로 구독을 푼다.
 * setLink는 API 요청(api.setLink)이다. 테스트에서 바꿔 넣는다.
 */
export function createLinkPropagation(
  board: BoardStore,
  setLink: SetLinkRequest = api.setLink,
) {
  /** 보낼 것이 있는 따르는 칸 */
  const dirty = new Set<string>();
  /** 응답을 기다리는 따르는 칸 (한 칸에 한 요청만) */
  const inFlight = new Set<string>();
  /** 범위가 바뀌었을 수 있는 따를 칸. 쉬게 되면 따르는 칸에 보낸다. */
  const changed = new Set<string>();
  /** 이 전파가 시작한 연결 다시 그리기 job. 끝나도 그 칸을 따르는 칸에 전파하지 않는다. */
  const linkJobs = new Set<string>();

  const followersOf = (s: BoardState, sourceId: string) =>
    Object.entries(s.links)
      .filter(([, link]) => link.follow === sourceId)
      .map(([id]) => id);

  const flush = (targetId: string) => {
    const s = board.getState();
    if (!dirty.has(targetId) || inFlight.has(targetId)) return;
    const store = s.panels[targetId];
    const current = store?.getState().current;
    if (!store || !current) {
      // 그린 적 없는 칸은 그릴 때 함께 건다. 그리는(여는) 중이면 그린 뒤에 보낸다.
      if (!store || !(store.getState().opening || s.busy[targetId]))
        dirty.delete(targetId);
      return;
    }
    if (!settled(s, targetId)) return;
    const follow = s.links[targetId]?.follow;
    // 따를 칸이 그리는 중이면 그 칸의 범위가 정해진 뒤에 보낸다.
    if (follow && s.panels[follow] && !settled(s, follow)) return;

    dirty.delete(targetId);
    inFlight.add(targetId);
    const { request } = linkRequestOf(s, targetId, current.spec);
    setLink(current.chartId, request)
      .then(({ jobId }) => {
        board.getState().setLinkError(targetId, null);
        // 기다리는 사이 칸이 지워졌거나 새로 그렸으면 그 job은 이 칸 것이 아니다.
        const now = board.getState().panels[targetId];
        if (!jobId || now !== store) return;
        if (store.getState().current?.chartId !== current.chartId) return;
        linkJobs.add(jobId);
        // item 다시 그리기로 둔다: 이전 PNG 위에 진행 표시를 얹고, 끝나면 새 PNG로 바꾼다.
        store.getState().setItemJob(PANEL_ITEM_KEY, jobId);
      })
      .catch((err: unknown) => {
        // 보내는 사이 이 칸이 그리기 시작했으면(409) 끝난 뒤 다시 보낸다.
        if (
          err instanceof ApiRequestError &&
          err.status === 409 &&
          !settled(board.getState(), targetId)
        ) {
          dirty.add(targetId);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        board.getState().setLinkError(targetId, message);
      })
      .finally(() => {
        inFlight.delete(targetId);
        flush(targetId);
      });
  };

  const request = (targetId: string) => {
    if (!board.getState().panels[targetId]) return;
    dirty.add(targetId);
    flush(targetId);
  };

  /** 쉬게 된 칸: 범위가 바뀐 따를 칸이면 따르는 칸에 보내고, 기다리던 요청을 보낸다. */
  const onSettled = (id: string) => {
    const s = board.getState();
    if (!settled(s, id)) return;
    if (changed.delete(id)) for (const f of followersOf(s, id)) request(f);
    // 이 칸을 기다리던 따르는 칸과 이 칸 자신의 요청
    for (const f of followersOf(s, id)) flush(f);
    flush(id);
  };

  const onPanel = (next: WorkspaceState, prev: WorkspaceState) => {
    const id = next.id;
    if (next.current && next.current.chartId !== prev.current?.chartId) {
      // 새로 그렸다: 선택이 사라졌거나(draw) 저장한 선택으로 돌아왔다(다시 열기). 다 그린 뒤 따르는 칸의 범위를 다시 정한다.
      changed.add(id);
      // 이 칸이 따르는 칸이면 그릴 때 함께 걸지 못했을 수 있다(따를 칸이 그리는 중). 다 그린 뒤 확인한다.
      if (board.getState().links[id]) dirty.add(id);
    }
    for (const jobId of startedJobs(next, prev)) {
      // 연결 다시 그리기는 이 칸의 범위를 바꾸지 않는다 (전파는 한 단계).
      if (linkJobs.delete(jobId)) continue;
      changed.add(id);
    }
    onSettled(id);
  };

  const panelSubs = new Map<WorkspaceStore, () => void>();
  const syncPanels = (panels: BoardState["panels"]) => {
    const alive = new Set(Object.values(panels));
    for (const [store, stop] of panelSubs)
      if (!alive.has(store)) {
        stop();
        panelSubs.delete(store);
      }
    for (const store of alive)
      if (!panelSubs.has(store)) panelSubs.set(store, store.subscribe(onPanel));
  };
  syncPanels(board.getState().panels);

  const stopBoard = board.subscribe((s, prev) => {
    if (s.panels !== prev.panels) {
      syncPanels(s.panels);
      for (const id of [...dirty, ...changed])
        if (!s.panels[id]) {
          dirty.delete(id);
          changed.delete(id);
        }
    }
    if (s.links !== prev.links) {
      // 연결을 걸거나 바꾸거나 풀었다(칸이 지워져 풀린 것 포함): 그 칸의 범위를 다시 정한다.
      const ids = new Set([
        ...Object.keys(s.links),
        ...Object.keys(prev.links),
      ]);
      for (const id of ids) if (s.links[id] !== prev.links[id]) request(id);
    }
    if (s.busy !== prev.busy)
      for (const id of Object.keys(prev.busy)) if (!s.busy[id]) onSettled(id);
  });

  return {
    stop: () => {
      stopBoard();
      for (const stop of panelSubs.values()) stop();
      panelSubs.clear();
    },
  };
}
