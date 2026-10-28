"use client";

import {
  type LucideIcon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
} from "lucide-react";
import type { LegendPosition } from "@/shared/api/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { segmented } from "./segmented";

const s = segmented();

const messages = defineMessages({
  ko: {
    group: "legend 위치",
    position: { top: "위", bottom: "아래", left: "왼쪽", right: "오른쪽" },
  },
  en: {
    group: "legend position",
    position: { top: "Top", bottom: "Bottom", left: "Left", right: "Right" },
  },
});

const POSITIONS = [
  { value: "top", Icon: PanelTop },
  { value: "bottom", Icon: PanelBottom },
  { value: "left", Icon: PanelLeft },
  { value: "right", Icon: PanelRight },
] as const satisfies readonly {
  value: LegendPosition;
  Icon: LucideIcon;
}[];

/** legend 위치(위·아래·왼쪽·오른쪽) 고르기. 고른 위치는 aria-pressed로 표시한다. */
export function LegendPositionPicker({
  value,
  onSelect,
  disabled = false,
}: {
  value: LegendPosition;
  onSelect: (position: LegendPosition) => void;
  disabled?: boolean;
}) {
  const text = useT(messages);
  return (
    <fieldset className={s.root()} aria-label={text.group}>
      {POSITIONS.map(({ value: position, Icon }) => (
        <button
          key={position}
          type="button"
          className={s.item()}
          aria-pressed={position === value}
          disabled={disabled}
          onClick={() => position !== value && onSelect(position)}
        >
          <Icon size={14} aria-hidden="true" />
          {text.position[position]}
        </button>
      ))}
    </fieldset>
  );
}
