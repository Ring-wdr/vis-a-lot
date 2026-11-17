"use client";

import { memo, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { fitLink } from "@/entities/workspace/lib/panel-link";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { useDatasetSchema } from "@/shared/api/queries";
import { createLinkPropagation } from "../model/link-propagation";

/**
 * 연결 하나를 두 칸의 지금 설정에 맞춘다: 이 칸 차트가 강조를 쓸 수 없게 되면 거르기로, 데이터셋이 다르면
 * 연결 컬럼을 기본값으로(어느 쪽이든 데이터셋이 바뀌면 다시) 정한다. 따를 칸은 그린 설정, 이 칸은 고치는 설정을 본다.
 */
function FitLink({
  panelId,
  source,
  target,
}: {
  panelId: string;
  source: WorkspaceStore;
  target: WorkspaceStore;
}) {
  const board = useBoardStore();
  const link = useBoard((s) => s.links[panelId]);
  const sourceDataset = useStore(
    source,
    (s) => (s.current?.spec ?? s.draft).dataset,
  );
  const spec = useStore(
    target,
    useShallow((s) => ({
      dataset: s.draft.dataset,
      chartType: s.draft.chartType,
      subType: s.draft.subType,
    })),
  );
  const sourceColumns = useDatasetSchema(sourceDataset).data?.columns;
  const targetColumns = useDatasetSchema(spec.dataset).data?.columns;
  // 데이터셋 쌍이 바뀌면 연결 컬럼을 기본값으로 다시 정한다. 두 스키마를 받을 때까지 미룬다.
  const pair = `${sourceDataset}\u0000${spec.dataset}`;
  const lastPair = useRef(pair);
  const reset = useRef(false);

  useEffect(() => {
    if (lastPair.current !== pair) {
      lastPair.current = pair;
      reset.current = true;
    }
    if (!link) return;
    const next = fitLink(link, {
      sourceDataset,
      target: spec,
      sourceColumns,
      targetColumns,
      reset: reset.current,
    });
    if (
      reset.current &&
      (sourceDataset === spec.dataset || (sourceColumns && targetColumns))
    )
      reset.current = false;
    if (next !== link) board.getState().setLink(panelId, next);
  }, [
    board,
    panelId,
    link,
    pair,
    sourceDataset,
    spec,
    sourceColumns,
    targetColumns,
  ]);
  return null;
}

const LinkFit = memo(function LinkFit({ panelId }: { panelId: string }) {
  const follow = useBoard((s) => s.links[panelId]?.follow);
  const source = useBoard((s) => (follow ? s.panels[follow] : undefined));
  const target = useBoard((s) => s.panels[panelId]);
  if (!source || !target) return null;
  // 따를 칸을 바꾸면 처음부터 다시 맞춘다.
  return (
    <FitLink key={follow} panelId={panelId} source={source} target={target} />
  );
});

/**
 * 보드의 칸 연결을 돌린다. 그리지 않는다.
 * - 연결 전파: 따를 칸의 범위가 바뀌면 따르는 칸에 범위를 건다 (createLinkPropagation).
 * - 연결 맞추기: 데이터셋·차트 종류가 바뀌면 방식·연결 컬럼을 다시 정한다.
 */
export function LinkSync() {
  const board = useBoardStore();
  const followers = useBoard(useShallow((s) => Object.keys(s.links)));
  useEffect(() => createLinkPropagation(board).stop, [board]);
  return followers.map((id) => <LinkFit key={id} panelId={id} />);
}
