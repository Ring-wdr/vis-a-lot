"use client";

import type { ItemAction } from "@/lib/item-actions";
import type { ItemState } from "@/server/api/types";
import styles from "./Workspace.module.css";

const ZOOM_OUT_RATIO = 2;

/** item별 툴바: 축소, 확대 초기화, 도형 undo, 도형 전체 삭제 */
export function ItemToolbar({
  item,
  busy,
  undoCount,
  onAction,
}: {
  item: ItemState;
  busy: boolean;
  /** 이 세션에서 그린 도형 수 */
  undoCount: number;
  onAction: (action: ItemAction) => void;
}) {
  const drawn = item.status === "success";
  const disabled = busy || !drawn;

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
        −
      </button>
      <button
        type="button"
        title="확대 초기화"
        aria-label="확대 초기화"
        disabled={disabled || !item.zoomed}
        onClick={() => onAction({ type: "view", body: { type: "reset" } })}
      >
        ⟲
      </button>
      <button
        type="button"
        title="도형 되돌리기"
        aria-label="도형 되돌리기"
        disabled={disabled || undoCount === 0 || item.shapeCount === 0}
        onClick={() => onAction({ type: "undoShape" })}
      >
        ↶
      </button>
      <button
        type="button"
        title="도형 전체 삭제"
        aria-label="도형 전체 삭제"
        disabled={disabled || item.shapeCount === 0}
        onClick={() => onAction({ type: "clearShapes" })}
      >
        ⌫
      </button>
    </div>
  );
}
