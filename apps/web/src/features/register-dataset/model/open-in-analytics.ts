"use client";

// datastore의 `analytics에서 열기`. 보드의 빈 칸(그린 적 없는 칸)에, 없으면 새 칸에 고른 데이터를 넣는다.
// 보드를 아직 서버에서 받아 채우지 않았으면(이 세션에서 /analytics를 처음 연다) 채운 뒤 넣도록 맡겨 둔다.
// 채우기 전에 넣으면 받은 보드가 그 칸을 덮는다.

import { t } from "@lingui/core/macro";
import { MAX_PANELS } from "@/entities/workspace/lib/layout-tree";
import {
  type BoardStore,
  selectLayoutLocked,
} from "@/entities/workspace/model/board-store";
import type { DatasetId } from "@/shared/api/types";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import "../config/messages";

const queued = new WeakMap<BoardStore, DatasetId>();

/** 칸이 그린 적 없는 빈 칸인지 */
function isEmptyPanel(board: BoardStore, panelId: string) {
  const { current, opening } = board.getState().panels[panelId].getState();
  return !current && !opening;
}

/** 보드에 데이터를 넣는다. 넣었으면(또는 맡겼으면) true */
async function placeDataset(board: BoardStore, dataset: DatasetId) {
  const s = board.getState();
  const empty = s.panelIds.find((id) => isEmptyPanel(board, id));
  if (empty) {
    s.panels[empty].getState().updateDraft({ dataset });
    s.activate(empty);
    return true;
  }
  if (s.panelIds.length < MAX_PANELS) {
    if (selectLayoutLocked(s)) {
      showAlert(
        t`그리는 칸이 있어 칸을 더할 수 없습니다. 끝나거나 cancel한 뒤 다시 열어 주세요.`,
      );
      return false;
    }
    return s.addPanel({ dataset }) !== undefined;
  }
  // 9칸이 모두 그린 칸이면 활성 칸의 데이터를 바꿀지 묻는다.
  const ok = await showConfirm(
    t`칸이 가득 찼습니다. 지금 고른 칸의 데이터를 바꿀까요?`,
    {
      confirmLabel: t({ message: "바꾸기", context: "replace panel dataset" }),
    },
  );
  if (!ok) return false;
  const active = board.getState();
  active.panels[active.activePanelId].getState().updateDraft({ dataset });
  return true;
}

/**
 * 고른 데이터를 analytics 보드에 넣는다. 보드를 아직 채우지 않았으면 맡겨 두고 true를 돌려준다
 * (/analytics가 보드를 채운 뒤 takeQueuedDataset으로 꺼내 넣는다). 넣지 않았으면 false.
 */
export async function openDatasetInAnalytics(
  board: BoardStore,
  dataset: DatasetId,
) {
  if (!board.getState().hydrated) {
    queued.set(board, dataset);
    return true;
  }
  return placeDataset(board, dataset);
}

/** 보드를 채운 뒤 맡겨 둔 데이터를 넣는다. 한 번 꺼내면 지운다. */
export async function placeQueuedDataset(board: BoardStore) {
  const dataset = queued.get(board);
  queued.delete(board);
  if (dataset) await placeDataset(board, dataset);
}
