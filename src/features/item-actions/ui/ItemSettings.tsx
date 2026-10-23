"use client";

import type { ReactNode } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import { useItemMeta } from "@/shared/api/queries";
import type { ItemState, LegendPosition } from "@/shared/api/types";
import { colorName } from "@/shared/lib/palette";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendListSkeleton } from "@/shared/ui/LegendListSkeleton";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import { settingsStyles } from "@/shared/ui/settings-styles";

const s = settingsStyles();

const POSITION_LABELS: Record<LegendPosition, string> = {
  top: "위",
  bottom: "아래",
  left: "왼쪽",
  right: "오른쪽",
};

/**
 * item 설정 팝업 본문: legend 위치와 색, (children) 차트 속성. 바꿀 때마다 그 item만 다시 그린다.
 * legend 값과 지금 그린 색은 PNG metadata에서 읽는다.
 */
export function ItemSettings({
  item,
  hasLegend,
  commonPosition,
  disabled,
  open,
  onAction,
  children,
}: {
  /** 끝에 붙는 묶음 (차트 속성 편집 진입점) */
  children?: ReactNode;
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
    <div className={s.popoverBody()}>
      <strong>{item.label} 설정</strong>
      {hasLegend && (
        <section className={s.group()}>
          <h4 className={s.groupTitle()}>legend 위치</h4>
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
              className={linkButton()}
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
      <section className={s.group()}>
        <h4 className={s.groupTitle()}>색상</h4>
        {!hasLegend ? (
          <>
            <ColorSwatches
              value={item.color}
              disabled={disabled}
              onSelect={(color) => onAction({ type: "color", color })}
            />
            <p className="text-xs text-fg-muted">{colorName(item.color)}</p>
          </>
        ) : legend ? (
          <ul className={s.legendList()}>
            {legend.values.map((value, i) => (
              <li key={value} className={s.legendItem()}>
                <ColorPickerButton
                  className={s.legendSwatch()}
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
          <LegendListSkeleton />
        )}
        {item.customColor && (
          <button
            type="button"
            className={linkButton()}
            disabled={disabled}
            onClick={() => onAction({ type: "color", color: null })}
          >
            공통 색 따르기
          </button>
        )}
      </section>
      {children}
    </div>
  );
}
