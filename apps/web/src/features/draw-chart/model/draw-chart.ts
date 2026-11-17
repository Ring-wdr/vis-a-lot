"use client";

import { t } from "@lingui/core/macro";
import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { drawSizeFor } from "@/entities/chart/lib/grid-layout";
import {
  type DrawnChart,
  recordsHistory,
  type WorkspaceStore,
} from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import "../config/messages";

/** draw mutation의 key. 탭·칸을 오가 다시 마운트돼도 useWorkspaceMutating("draw")가 이 key로 진행 중인지 찾는다. */
export const drawMutationKey = (store: WorkspaceStore) => [
  "draw",
  store.getState().id,
];

/**
 * 이 작업 상태의 지금 draft로 차트를 만든다 (POST /charts). 그린 차트(current)의 spec도 이 값이다.
 * PNG 크기는 grid 영역(칸이면 칸 전체)에서 잰다. analytics 칸은 history에 남기지 않는다.
 */
export async function requestDraw(store: WorkspaceStore): Promise<DrawnChart> {
  const state = store.getState();
  const { gridArea, draft } = state;
  if (!gridArea) throw new Error(t`grid 영역 크기를 아직 모릅니다.`);
  const res = await api.createChart({
    spec: draft,
    itemSize: drawSizeFor(gridArea, draft.grid, state.kind === "panel"),
    record: recordsHistory(state),
  });
  return { ...res, spec: draft };
}

/**
 * 컴포넌트 밖에서 draw를 보낸다 (analytics의 draw all). DrawButton과 같은 mutation key로 보내
 * 그 칸의 draw 버튼·그리는 중 표시가 똑같이 따라온다. 실패하면 그 칸에 알린다.
 */
export function drawIn(client: QueryClient, store: WorkspaceStore) {
  const observer = new MutationObserver(client, {
    mutationKey: drawMutationKey(store),
    mutationFn: () => requestDraw(store),
    onSuccess: (chart: DrawnChart) => store.getState().setCurrent(chart),
    onError: (err: Error) => store.getState().notify(err.message),
  });
  return observer.mutate().catch(() => undefined);
}
