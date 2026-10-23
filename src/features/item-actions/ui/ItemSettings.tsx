"use client";

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

type DrawnItem = ItemState & { image: NonNullable<ItemState["image"]> };

/**
 * item 속성 팝업 · 범례 구역의 legend 위치. 바꾸면 그 item만 다시 그린다.
 * 정하지 않으면 공통 속성의 위치를 따른다.
 */
export function ItemLegendPositionSettings({
  item,
  commonPosition,
  disabled,
  onAction,
}: {
  item: DrawnItem;
  /** 공통 속성의 legend 위치 */
  commonPosition: LegendPosition;
  disabled: boolean;
  onAction: (action: ItemAction) => void;
}) {
  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>위치</h4>
      <LegendPositionPicker
        value={item.legendPosition ?? commonPosition}
        disabled={disabled}
        onSelect={(position) => onAction({ type: "legendPosition", position })}
      />
      {item.legendPosition && (
        <button
          type="button"
          className={linkButton()}
          disabled={disabled}
          onClick={() => onAction({ type: "legendPosition", position: null })}
        >
          공통 위치 따르기 ({POSITION_LABELS[commonPosition]})
        </button>
      )}
    </div>
  );
}

/**
 * item 속성 팝업 · 팔레트 구역의 색. legend가 없으면 item 색 하나, 있으면 legend 값별 색을 바꾼다.
 * legend 값과 지금 그린 색은 PNG metadata에서 읽는다.
 */
export function ItemColorSettings({
  item,
  hasLegend,
  disabled,
  onAction,
}: {
  item: DrawnItem;
  hasLegend: boolean;
  disabled: boolean;
  onAction: (action: ItemAction) => void;
}) {
  const meta = useItemMeta(item.image.url, hasLegend);
  const legend = meta.data?.legend;

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>{hasLegend ? "범례 값별 색" : "색"}</h4>
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
    </div>
  );
}
