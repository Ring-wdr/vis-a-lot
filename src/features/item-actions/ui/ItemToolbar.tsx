"use client";

import type { ItemState } from "@server/api/types";
import { Eraser, RotateCcw, Undo2, ZoomOut } from "lucide-react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { colorName } from "@/shared/lib/palette";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { Popover } from "@/shared/ui/Popover";
import styles from "@/shared/ui/workspace.module.css";

const ZOOM_OUT_RATIO = 2;

/** item별 툴바: 축소, 확대 초기화, 도형 undo, 도형 전체 삭제, 개별 색상 */
export function ItemToolbar({
  item,
  busy,
  undoCount,
  hasLegend = false,
  onAction,
}: {
  item: ItemState;
  /** legend가 있으면 개별 색은 PNG 안 legend 항목에서 바꾼다. */
  hasLegend?: boolean;
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
      {!hasLegend && (
        <Popover
          triggerClassName={styles.colorButton}
          triggerLabel={`개별 색상: ${colorName(item.color)}${item.customColor ? " (개별)" : ""}`}
          disabled={disabled}
          trigger={
            <span
              className={styles.colorDot}
              data-custom={item.customColor || undefined}
              style={{ background: item.color }}
            />
          }
        >
          {(close) => (
            <div className={styles.popoverBody}>
              <strong>{item.label} 색상</strong>
              <ColorSwatches
                value={item.color}
                onSelect={(color) => {
                  onAction({ type: "color", color });
                  close();
                }}
              />
              {item.customColor && (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    onAction({ type: "color", color: null });
                    close();
                  }}
                >
                  공통 색 따르기
                </button>
              )}
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
