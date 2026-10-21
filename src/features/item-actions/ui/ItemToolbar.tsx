"use client";

import { Eraser, RotateCcw, Settings, Undo2, ZoomOut } from "lucide-react";
import { useState } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState, LegendPosition } from "@/shared/api/types";
import { Popover } from "@/shared/ui/Popover";
import styles from "@/shared/ui/workspace.module.css";
import { ItemSettings } from "./ItemSettings";

const ZOOM_OUT_RATIO = 2;

/** item별 툴바: 축소, 확대 초기화, 도형 undo, 도형 전체 삭제, 설정(legend 위치·개별 색) */
export function ItemToolbar({
  item,
  busy,
  undoCount,
  hasLegend = false,
  commonPosition = "top",
  onAction,
}: {
  item: ItemState;
  /** legend가 있으면 개별 색을 legend 값별로 바꾸고 위치를 고른다. */
  hasLegend?: boolean;
  /** 공통 속성의 legend 위치 */
  commonPosition?: LegendPosition;
  busy: boolean;
  /** 이 세션에서 그린 도형 수 */
  undoCount: number;
  onAction: (action: ItemAction) => void;
}) {
  const drawn = item.status === "success";
  const disabled = busy || !drawn;
  // 설정 팝업을 한 번 열면 그 뒤로는 metadata를 캐시에서 바로 쓴다.
  const [settingsOpened, setSettingsOpened] = useState(false);

  return (
    <div
      className={styles.itemActions}
      role="toolbar"
      aria-label={`${item.label} 도구`}
    >
      <button
        type="button"
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
        title="확대 초기화"
        aria-label="확대 초기화"
        disabled={disabled || !item.zoomed}
        onClick={() => onAction({ type: "view", body: { type: "reset" } })}
      >
        <RotateCcw size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        title="도형 되돌리기"
        aria-label="도형 되돌리기"
        disabled={disabled || undoCount === 0 || item.shapeCount === 0}
        onClick={() => onAction({ type: "undoShape" })}
      >
        <Undo2 size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        title="도형 전체 삭제"
        aria-label="도형 전체 삭제"
        disabled={disabled || item.shapeCount === 0}
        onClick={() => onAction({ type: "clearShapes" })}
      >
        <Eraser size={13} aria-hidden="true" />
      </button>
      {drawn && item.image && (
        <Popover
          triggerLabel="item 설정"
          disabled={busy}
          width={300}
          onOpen={() => setSettingsOpened(true)}
          trigger={<Settings size={13} aria-hidden="true" />}
        >
          {() => (
            <ItemSettings
              item={{
                ...item,
                image: item.image as NonNullable<ItemState["image"]>,
              }}
              hasLegend={hasLegend}
              commonPosition={commonPosition}
              disabled={disabled}
              open={settingsOpened}
              onAction={onAction}
            />
          )}
        </Popover>
      )}
    </div>
  );
}
