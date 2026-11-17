"use client";

import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  type BoardState,
  selectLayoutLocked,
} from "@/entities/workspace/model/board-store";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import { queryKeys } from "@/shared/api/queries";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import "../config/messages";
import { drawIn } from "../model/draw-chart";

type DatasetList = Awaited<ReturnType<typeof api.datasets>>;

/**
 * 칸을 그릴 수 있는지: 칸 크기를 알고, x·y를 골랐고, 데이터셋이 지워지지 않았고, 이미 그리는 중이 아니다.
 * 데이터셋 목록을 아직 받지 못했으면 지웠는지 모르므로 보낸다 (job이 사유를 알려 준다).
 */
function drawable(
  store: WorkspaceStore,
  datasets: DatasetList | undefined,
  busy: boolean,
) {
  const { gridArea, draft, opening } = store.getState();
  if (busy || opening || !gridArea) return false;
  if (draft.x === "" || draft.y === "") return false;
  return !datasets || datasets.datasets.some((d) => d.id === draft.dataset);
}

/** 칸의 draw job과 item 다시 그리기 job을 취소한다. 끝난 job이면 서버가 무시한다. */
function cancelPanel(store: WorkspaceStore) {
  const { current, itemJobs } = store.getState();
  for (const jobId of [current?.jobId, ...Object.values(itemJobs)])
    if (jobId) api.cancelJob(jobId).catch(() => {});
}

/**
 * analytics 보드의 draw all: 설정이 유효한 모든 칸을 번호 순으로 그린다. 건너뛴 칸이 있으면 개수를 알린다.
 * 그리는 칸이 하나라도 있으면 cancel all이 되어 모든 칸의 job을 취소한다.
 */
export function DrawAllButton() {
  const { t } = useLingui();
  const client = useQueryClient();
  const board = useBoardStore();
  const drawing = useBoard(selectLayoutLocked);

  const drawAll = () => {
    const s: BoardState = board.getState();
    const datasets = client.getQueryData<DatasetList>(queryKeys.datasets);
    let skipped = 0;
    for (const id of s.panelIds) {
      const store = s.panels[id];
      if (drawable(store, datasets, s.busy[id] === true))
        void drawIn(client, store);
      else skipped++;
    }
    if (skipped > 0)
      showAlert(
        t({
          message: plural(skipped, {
            other:
              "설정이 끝나지 않았거나 그리는 중인 칸 #개는 건너뛰었습니다.",
          }),
          comment: "draw all에서 그리지 않은 칸 수",
        }),
      );
  };

  const cancelAll = () => {
    const { panels } = board.getState();
    for (const store of Object.values(panels)) cancelPanel(store);
  };

  return drawing ? (
    <button
      type="button"
      className={button({
        variant: "danger",
        size: "sm",
        class: "whitespace-nowrap",
      })}
      title={t`그리는 모든 칸을 취소합니다`}
      onClick={cancelAll}
    >
      <Square size={13} aria-hidden="true" />
      cancel all
    </button>
  ) : (
    <button
      type="button"
      className={button({
        variant: "primary",
        size: "sm",
        class: "whitespace-nowrap",
      })}
      title={t`설정이 끝난 모든 칸을 번호 순으로 그립니다`}
      onClick={drawAll}
    >
      <Play size={13} aria-hidden="true" />
      draw all
    </button>
  );
}
