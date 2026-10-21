"use client";

import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { useItemMeta } from "@/shared/api/queries";
import type { ItemState, LegendPosition } from "@/shared/api/types";
import { colorName } from "@/shared/lib/palette";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import styles from "@/shared/ui/workspace.module.css";

const POSITION_LABELS: Record<LegendPosition, string> = {
  top: "위",
  bottom: "아래",
  left: "왼쪽",
  right: "오른쪽",
};

/**
 * item 설정 팝업 본문: legend 위치와 색. 바꿀 때마다 그 item만 다시 그린다.
 * legend 값과 지금 그린 색은 PNG metadata에서 읽는다.
 */
export function ItemSettings({
  item,
  hasLegend,
  commonPosition,
  disabled,
  open,
  onAction,
}: {
  item: ItemState & { image: NonNullable<ItemState["image"]> };
  hasLegend: boolean;
  /** 공통 속성의 legend 위치 */
  commonPosition: LegendPosition;
  disabled: boolean;
  /** 팝업이 열렸을 때만 metadata를 받는다. */
  open: boolean;
  onAction: (action: ItemAction) => void;
}) {
  const meta = useItemMeta(item.image.url, open && hasLegend);
  const legend = meta.data?.legend;

  return (
    <div className={styles.popoverBody}>
      <strong>{item.label} 설정</strong>
      {hasLegend && (
        <section className={styles.settingsGroup}>
          <h4>legend 위치</h4>
          <LegendPositionPicker
            value={item.legendPosition ?? commonPosition}
            disabled={disabled}
            onSelect={(position) =>
              onAction({ type: "legendPosition", position })
            }
          />
          {item.legendPosition && (
            <button
              type="button"
              className={styles.linkButton}
              disabled={disabled}
              onClick={() =>
                onAction({ type: "legendPosition", position: null })
              }
            >
              공통 위치 따르기 ({POSITION_LABELS[commonPosition]})
            </button>
          )}
        </section>
      )}
      <section className={styles.settingsGroup}>
        <h4>색상</h4>
        {!hasLegend ? (
          <>
            <ColorSwatches
              value={item.color}
              disabled={disabled}
              onSelect={(color) => onAction({ type: "color", color })}
            />
            <p className={styles.muted}>{colorName(item.color)}</p>
          </>
        ) : legend ? (
          <ul className={styles.legendList}>
            {legend.values.map((value, i) => (
              <li key={value}>
                <ColorPickerButton
                  className={styles.legendSwatch}
                  style={{ background: legend.colors[i] }}
                  color={legend.colors[i]}
                  label={`${value} 색 바꾸기`}
                  disabled={disabled}
                  onCommit={(color) =>
                    onAction({ type: "legendColor", value, color })
                  }
                />
                <span>{value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>불러오는 중…</p>
        )}
        {item.customColor && (
          <button
            type="button"
            className={styles.linkButton}
            disabled={disabled}
            onClick={() => onAction({ type: "color", color: null })}
          >
            공통 색 따르기
          </button>
        )}
      </section>
    </div>
  );
}
