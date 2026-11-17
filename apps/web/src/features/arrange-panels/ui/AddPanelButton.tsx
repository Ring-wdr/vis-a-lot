"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { Plus } from "lucide-react";
import { useBoard } from "@/entities/workspace/model/board-scope";
import { button } from "@/shared/ui/button";
import "../config/messages";
import { addPanelBlock, blockedReason } from "../model/arrange";

/** 보드 도구 줄의 칸 추가. 9칸이거나 그리는 칸이 있으면 막고 이유를 title로 알린다. */
export function AddPanelButton({ className }: { className?: string }) {
  const { t } = useLingui();
  const blocked = useBoard(addPanelBlock);
  const addPanel = useBoard((s) => s.addPanel);
  return (
    <button
      type="button"
      className={button({ size: "sm", className })}
      disabled={blocked !== undefined}
      title={blocked ? blockedReason(blocked) : t`보드에 빈 칸을 더합니다`}
      // 9칸·잠금은 store도 막는다.
      onClick={() => addPanel()}
    >
      <Plus size={14} aria-hidden="true" />
      <span className="whitespace-nowrap">
        <Trans>칸 추가</Trans>
      </span>
    </button>
  );
}
