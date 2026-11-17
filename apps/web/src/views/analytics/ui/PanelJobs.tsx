"use client";

import { memo, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  PanelScope,
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import { useDrawState } from "@/features/draw-chart/model/draw-state";
import { useJobProgress } from "@/shared/api/queries";
import type { JobStateResponse } from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { usePanelStatus } from "../model/panel-status";

/** job이 실패했거나 item이 실패했는지. 진행률 응답마다 바뀌는 값은 고르지 않는다. */
const jobFailed = (job: JobStateResponse) =>
  job.status === "failed" || job.counts.failed > 0;

/**
 * 칸 하나의 job 상태를 보드에 옮긴다: 그리는 중(draw, 다시 열기, item 다시 그리기)이면 보드 store의 busy,
 * 실패면 하단 줄의 실패 수. 칸에서 난 오류(도구·다시 열기)는 팝업으로 띄운다. 아무것도 그리지 않는다.
 * 칸 차트와 떼어 두어, 칸이 보이지 않아도(다른 칸 최대화) 돌고 진행률 응답이 칸 차트를 다시 그리지 않게 한다.
 */
const PanelJobSync = memo(function PanelJobSync({
  panelId,
}: {
  panelId: string;
}) {
  const board = useBoardStore();
  const store = useWorkspaceStore();
  const drawing = useDrawState() !== "draw";
  const redrawing = useWorkspace((s) => Object.keys(s.itemJobs).length > 0);
  const jobId = useWorkspace((s) => s.current?.jobId);
  // 고른 값은 조건 앞에서 읽는다 (state-subscriptions.md).
  const failed = useJobProgress(jobId, jobFailed).data === true;
  const busy = drawing || redrawing;
  const setFailed = usePanelStatus((s) => s.setFailed);

  useEffect(() => {
    board.getState().setPanelBusy(panelId, busy);
  }, [board, panelId, busy]);
  useEffect(() => setFailed(panelId, failed), [setFailed, panelId, failed]);
  // 화면을 떠나거나 칸이 지워지면 푼다. 돌아오면 다시 잰다.
  useEffect(
    () => () => {
      board.getState().setPanelBusy(panelId, false);
      setFailed(panelId, false);
    },
    [board, panelId, setFailed],
  );

  useEffect(() => {
    // 꺼내면서 비우므로 StrictMode에서 effect가 두 번 돌아도 한 번만 뜬다.
    const flush = () => {
      const { notices } = store.getState();
      if (notices.length === 0) return;
      store.setState({ notices: [] });
      for (const message of notices) showAlert(message);
    };
    flush();
    return store.subscribe(flush);
  }, [store]);
  return null;
});

/** 모든 칸의 job 상태 옮기기. 칸 id 목록만 구독한다. */
export function PanelJobs() {
  const ids = useBoard(useShallow((s) => s.panelIds));
  return ids.map((id) => (
    <PanelScope key={id} panelId={id}>
      <PanelJobSync panelId={id} />
    </PanelScope>
  ));
}
