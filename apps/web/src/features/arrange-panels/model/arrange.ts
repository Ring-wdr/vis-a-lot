// 칸 구성을 바꾸는 동작. 그린 차트가 지워지면 먼저 확인을 받는다.
// 보드 위젯(칸 닫기)과 도구 줄 버튼(레이아웃, 보드 비우기)이 함께 쓴다.

import { plural, t } from "@lingui/core/macro";
import {
  type LayoutPresetId,
  panelsRemovedByPreset,
} from "@/entities/workspace/lib/layout-presets";
import { MAX_PANELS } from "@/entities/workspace/lib/layout-tree";
import {
  type BoardState,
  type BoardStore,
  selectLayoutLocked,
  selectPanelNumber,
} from "@/entities/workspace/model/board-store";
import { showConfirm } from "@/shared/ui/AlertDialog";
import "../config/messages";

/** 그린 차트가 있는 칸인지 */
const isDrawn = (s: BoardState, panelId: string) =>
  s.panels[panelId]?.getState().current !== undefined;

/** 칸 구성을 바꾸는 조작이 막힌 까닭. 화면은 blockedReason으로 title 글자를 만든다. */
export type ArrangeBlock = "locked" | "limit" | "last";

/** 레이아웃을 바꾸는 조작(옮기기, 크기 조절, preset)이 막힌 까닭 */
export const layoutBlock = (s: BoardState): ArrangeBlock | undefined =>
  selectLayoutLocked(s) ? "locked" : undefined;

/** 칸 추가가 막힌 까닭 (그리는 칸, 9칸 한도) */
export const addPanelBlock = (s: BoardState): ArrangeBlock | undefined =>
  selectLayoutLocked(s)
    ? "locked"
    : s.panelIds.length >= MAX_PANELS
      ? "limit"
      : undefined;

/** 칸 삭제가 막힌 까닭 (그리는 칸, 마지막 한 칸) */
export const removePanelBlock = (s: BoardState): ArrangeBlock | undefined =>
  selectLayoutLocked(s)
    ? "locked"
    : s.panelIds.length <= 1
      ? "last"
      : undefined;

/** 막힌 까닭의 title 글자. 그리는 컴포넌트는 useLingui로 언어 변경을 구독한다. */
export function blockedReason(block: ArrangeBlock) {
  switch (block) {
    case "locked":
      return t`그리는 칸이 있어 레이아웃을 바꿀 수 없습니다. 그리기가 끝나거나 취소한 뒤에 바꿔 주세요.`;
    case "limit": {
      const max = MAX_PANELS;
      return t({
        message: `칸은 ${plural(max, { other: "#개" })}까지 둘 수 있습니다.`,
        comment: "보드 한 장의 칸 수 한도",
      });
    }
    case "last":
      return t`마지막 칸은 지울 수 없습니다.`;
  }
}

/** 칸을 지운다. 그린 차트가 있으면 확인을 받는다. 지웠으면 true */
export async function removePanelWithConfirm(
  board: BoardStore,
  panelId: string,
) {
  const s = board.getState();
  if (!s.panels[panelId]) return false;
  if (isDrawn(s, panelId)) {
    const n = selectPanelNumber(panelId)(s);
    const ok = await showConfirm(
      t`칸 ${n}의 차트가 함께 지워집니다. 지울까요?`,
      {
        title: t`칸 지우기`,
        confirmLabel: t({ message: "지우기", context: "confirm button" }),
        danger: true,
      },
    );
    if (!ok) return false;
  }
  board.getState().removePanel(panelId);
  return board.getState().panels[panelId] === undefined;
}

/**
 * preset을 적용한다. 지워질 칸(뒤 번호부터)에 그린 차트가 있으면 확인을 받는다. 적용했으면 true
 */
export async function applyPresetWithConfirm(
  board: BoardStore,
  presetId: LayoutPresetId,
) {
  const s = board.getState();
  const removed = panelsRemovedByPreset(s.layout, presetId);
  if (removed.some((id) => isDrawn(s, id))) {
    const count = removed.length;
    const ok = await showConfirm(
      t`${plural(count, { other: "마지막 칸 #개가 지워집니다." })} 지워지는 칸의 차트는 다시 볼 수 없습니다. 레이아웃을 바꿀까요?`,
      {
        title: t`레이아웃 바꾸기`,
        confirmLabel: t({ message: "바꾸기", context: "confirm button" }),
        danger: true,
      },
    );
    if (!ok) return false;
  }
  const before = board.getState().layout;
  board.getState().applyPreset(presetId);
  return board.getState().layout !== before;
}

/** 보드를 비운다: 확인 뒤 모든 칸의 job을 취소하고 빈 칸 하나로 되돌린다. 비웠으면 true */
export async function clearBoardWithConfirm(board: BoardStore) {
  const ok = await showConfirm(
    t`모든 칸과 그린 차트를 지우고 빈 칸 하나로 되돌립니다. 그리는 중인 칸은 취소합니다.`,
    {
      title: t`보드 비우기`,
      confirmLabel: t({ message: "비우기", context: "confirm button" }),
      danger: true,
    },
  );
  if (!ok) return false;
  board.getState().reset();
  return true;
}
