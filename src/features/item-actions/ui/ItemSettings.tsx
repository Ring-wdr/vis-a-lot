"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { useItemMeta } from "@/shared/api/queries";
import type { ItemState, LegendPosition } from "@/shared/api/types";
import { colorName, defaultLegendColor } from "@/shared/lib/palette";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { ColorSwatches } from "@/shared/ui/ColorSwatches";
import { LegendListSkeleton } from "@/shared/ui/LegendListSkeleton";
import { LegendPositionPicker } from "@/shared/ui/LegendPositionPicker";
import { settingsStyles } from "@/shared/ui/settings-styles";
import type { ItemPropsForm } from "../model/item-props-form";

const s = settingsStyles();

const POSITION_LABELS: Record<LegendPosition, string> = {
  top: "위",
  bottom: "아래",
  left: "왼쪽",
  right: "오른쪽",
};

type DrawnItem = ItemState & { image: NonNullable<ItemState["image"]> };

/**
 * item 속성 팝업 폼(ItemPropsForm)의 값을 고친다. 확인을 누르면 팝업이 한 번에 보낸다.
 * 보이는 값은 바꾼 값 → (따르기를 골랐으면) 공통 속성 → 지금 item 값 순서로 고른다.
 */
type DraftProps = {
  item: DrawnItem;
  disabled: boolean;
};

function useItemPropsForm() {
  const { control, setValue } = useFormContext<ItemPropsForm>();
  const [color, legendColors, legendPosition] = useWatch({
    control,
    name: ["color", "legendColors", "legendPosition"],
  });
  const set = <K extends keyof ItemPropsForm>(
    key: K,
    value: ItemPropsForm[K],
  ) => setValue(key, value as never, { shouldDirty: true });
  return { changes: { color, legendColors, legendPosition }, set };
}

/** item 속성 팝업 · 범례 구역의 legend 위치. 정하지 않으면 공통 속성의 위치를 따른다. */
export function ItemLegendPositionSettings({
  item,
  disabled,
  commonPosition,
}: DraftProps & {
  /** 공통 속성의 legend 위치 */
  commonPosition: LegendPosition;
}) {
  const { changes, set } = useItemPropsForm();
  const own =
    changes.legendPosition !== undefined
      ? changes.legendPosition
      : (item.legendPosition ?? null);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>위치</h4>
      <LegendPositionPicker
        value={own ?? commonPosition}
        disabled={disabled}
        onSelect={(next) => set("legendPosition", next)}
      />
      {own !== null && (
        <button
          type="button"
          className={linkButton()}
          disabled={disabled}
          onClick={() => set("legendPosition", null)}
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
  disabled,
  hasLegend,
  common,
}: DraftProps & {
  hasLegend: boolean;
  /** 공통 색 따르기를 고른 뒤 보일 공통 속성의 색 */
  common: { color: string; legendColors?: Record<string, string> };
}) {
  const { changes, set } = useItemPropsForm();
  const meta = useItemMeta(item.image.url, hasLegend);
  const legend = meta.data?.legend;
  const reset = changes.color === null;
  const color = changes.color ?? (reset ? common.color : item.color);
  const legendColorOf = (value: string, index: number) =>
    changes.legendColors[value] ??
    (reset
      ? (common.legendColors?.[value] ?? defaultLegendColor(index))
      : legend?.colors[index]);
  const custom =
    Object.keys(changes.legendColors).length > 0 ||
    (reset ? false : changes.color !== undefined || item.customColor);

  return (
    <div className={s.section()}>
      <h4 className={s.heading()}>{hasLegend ? "범례 값별 색" : "색"}</h4>
      {!hasLegend ? (
        <>
          <ColorSwatches
            value={color}
            disabled={disabled}
            onSelect={(next) => set("color", next)}
          />
          <p className="text-xs text-fg-muted">{colorName(color)}</p>
        </>
      ) : legend ? (
        <ul className={s.legendList()}>
          {legend.values.map((value, i) => {
            const shown = legendColorOf(value, i) ?? common.color;
            return (
              <li key={value} className={s.legendItem()}>
                <ColorPickerButton
                  className={s.legendSwatch()}
                  style={{ background: shown }}
                  color={shown}
                  label={`${value} 색 바꾸기`}
                  disabled={disabled}
                  onCommit={(next) =>
                    set("legendColors", {
                      ...changes.legendColors,
                      [value]: next,
                    })
                  }
                />
                <span>{value}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <LegendListSkeleton />
      )}
      {custom && (
        <button
          type="button"
          className={linkButton()}
          disabled={disabled}
          onClick={() => {
            set("color", null);
            set("legendColors", {});
          }}
        >
          공통 색 따르기
        </button>
      )}
    </div>
  );
}
