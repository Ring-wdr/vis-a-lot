"use client";

import { useLingui } from "@lingui/react/macro";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { ChevronDown, Link2 } from "lucide-react";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import {
  selectFollowerNumbers,
  selectFollowNumber,
  selectPanelNumber,
} from "@/entities/workspace/model/board-store";
import { selectStyles } from "@/shared/ui/select-styles";
import "../config/messages";
import { useItemLink } from "../model/use-item-link";
import { LinkPopover, useLinkRangeText } from "./LinkPopover";

const s = selectStyles();

/** 이 칸의 연결 상태 글자들: 따르는 칸, 따르는 칸이 따르는 칸들, 걸린 범위, 거절 사유 */
function usePanelLink(panelId: string) {
  const follow = useBoard(selectFollowNumber(panelId));
  const followers = useBoard(useShallow(selectFollowerNumbers(panelId)));
  const error = useBoard((s) => s.linkErrors[panelId]);
  const store = useBoard((s) => s.panels[panelId]);
  const range = useItemLink(store);
  return { follow, followers, error, range: follow > 0 ? range : undefined };
}

/**
 * 칸 이름표의 연결 버튼(🔗). 따르는 칸이면 `← 1`, 이 칸을 따르는 칸이 있으면 `→ 2, 3`을 적는다.
 * 범위가 걸려 있으면 강조색, 서버가 연결을 거절했으면 경고색이다. 커서를 올리면 상대 칸 테두리를 강조한다.
 */
export const PanelLinkButton = memo(function PanelLinkButton({
  panelId,
}: {
  panelId: string;
}) {
  const { t } = useLingui();
  const board = useBoardStore();
  const number = useBoard(selectPanelNumber(panelId));
  const { follow, followers, error, range } = usePanelLink(panelId);
  const rangeText = useLinkRangeText();
  const list = followers.join(", ");
  const lines = [
    follow > 0 && t`따를 칸: 칸 ${follow}`,
    range && rangeText(range),
    followers.length > 0 && t`따르는 칸: ${list}`,
    error,
  ].filter(Boolean);
  return (
    <LinkPopover
      panelId={panelId}
      label={t`칸 ${number} 연결`}
      title={lines.length > 0 ? lines.join("\n") : t`칸 연결`}
      onHover={(hover) => board.getState().setLinkHover(hover ? panelId : null)}
      className={cn(
        "inline-flex h-5.5 min-w-6 flex-none cursor-pointer items-center justify-center gap-1 rounded-sm border border-transparent px-1 text-2xs text-fg-secondary tabular-nums hover:border-line hover:bg-elevated data-popup-open:border-accent",
        // 범위가 걸려 있으면 강조색, 거절됐으면 경고색
        error ? "text-danger" : range && "text-accent",
      )}
    >
      <Link2 size={13} aria-hidden="true" />
      {follow > 0 && <span>← {follow}</span>}
      {followers.length > 0 && <span>→ {list}</span>}
    </LinkPopover>
  );
});

/**
 * 왼쪽 패널의 `따를 칸`. 고른 칸의 연결 popover를 연다. 트리거에 따를 칸과 걸린 범위를 적는다.
 * 활성 칸이 바뀌면 그 칸 것으로 바뀐다.
 */
export function LinkField() {
  const { t } = useLingui();
  const panelId = useBoard((s) => s.activePanelId);
  const { follow, error, range } = usePanelLink(panelId);
  const rangeText = useLinkRangeText();
  return (
    <div className={s.field()}>
      <div className={s.labelRow()}>
        <span className={s.label()}>{t`따를 칸`}</span>
        {range && <span className={s.aside()}>{rangeText(range)}</span>}
      </div>
      <LinkPopover
        panelId={panelId}
        label={t`따를 칸`}
        title={error}
        className={s.trigger()}
      >
        <span className={cn(s.value(), follow === 0 && s.placeholder())}>
          {follow > 0
            ? t`칸 ${follow}`
            : t({ message: "없음", context: "no linked panel" })}
        </span>
        <span className={s.chevron()}>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </LinkPopover>
      {error && (
        <p role="alert" className="text-2xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
