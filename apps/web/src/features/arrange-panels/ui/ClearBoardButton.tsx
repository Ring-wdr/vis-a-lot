"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { Eraser } from "lucide-react";
import { useBoardStore } from "@/entities/workspace/model/board-scope";
import { useClearBoard } from "@/shared/api/queries";
import { button } from "@/shared/ui/button";
import "../config/messages";
import { clearBoardWithConfirm } from "../model/arrange";

/**
 * 보드 도구 줄의 보드 비우기. 확인 뒤 모든 칸의 job을 취소하고 빈 칸 하나로 되돌리고, 저장한 보드도 지운다.
 * 그리는 칸이 있어도 쓸 수 있다 (그 job을 취소한다).
 */
export function ClearBoardButton({ className }: { className?: string }) {
  const { t } = useLingui();
  const board = useBoardStore();
  const clear = useClearBoard();
  return (
    <button
      type="button"
      className={button({ size: "sm", className })}
      title={t`모든 칸을 지우고 빈 칸 하나로 되돌립니다`}
      onClick={async () => {
        if (await clearBoardWithConfirm(board)) clear.mutate();
      }}
    >
      <Eraser size={14} aria-hidden="true" />
      <span className="whitespace-nowrap">
        <Trans>보드 비우기</Trans>
      </span>
    </button>
  );
}
