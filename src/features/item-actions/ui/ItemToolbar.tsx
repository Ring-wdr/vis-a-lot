"use client";

import { ArchiveRestore, RotateCcw, Settings, ZoomOut } from "lucide-react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { itemButton } from "@/shared/ui/button";

const ZOOM_OUT_RATIO = 2;

/**
 * item별 툴바: 축소, 확대 초기화, 지운 점 되돌리기, 속성(legend 위치·개별 색·차트 속성 팝업).
 * 그리기 도구는 페인트 모드의 왼쪽 도구에 있다.
 */
export function ItemToolbar({
  item,
  busy,
  onOpenSettings,
  onAction,
}: {
  item: ItemState;
  busy: boolean;
  /** item 속성 팝업을 연다. 팝업은 item 카드(위젯)가 그린다. 없으면 버튼을 두지 않는다. */
  onOpenSettings?: () => void;
  onAction: (action: ItemAction) => void;
}) {
  const drawn = item.status === "success";
  const disabled = busy || !drawn;

  return (
    <div
      className="flex gap-0.5"
      role="toolbar"
      aria-label={`${item.label} 도구`}
    >
      <button
        type="button"
        className={itemButton()}
        title="축소"
        aria-label="축소"
        disabled={disabled || !item.zoomed}
        onClick={() =>
          onAction({
            type: "view",
            body: { type: "zoomOut", ratio: ZOOM_OUT_RATIO },
          })
        }
      >
        <ZoomOut size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={itemButton()}
        title="확대 초기화"
        aria-label="확대 초기화"
        disabled={disabled || !item.zoomed}
        onClick={() => onAction({ type: "view", body: { type: "reset" } })}
      >
        <RotateCcw size={13} aria-hidden="true" />
      </button>
      {/* 점을 지운 적이 있을 때만 보인다 (scatter). */}
      {item.deletionCount > 0 && (
        <button
          type="button"
          className={itemButton()}
          title="지운 점 되돌리기"
          aria-label="지운 점 되돌리기"
          disabled={disabled}
          onClick={() => onAction({ type: "undoDeletion" })}
        >
          <ArchiveRestore size={13} aria-hidden="true" />
        </button>
      )}
      {drawn && item.image && onOpenSettings && (
        <button
          type="button"
          className={itemButton()}
          title="item 속성"
          aria-label="item 속성"
          aria-haspopup="dialog"
          disabled={busy}
          onClick={onOpenSettings}
        >
          <Settings size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
