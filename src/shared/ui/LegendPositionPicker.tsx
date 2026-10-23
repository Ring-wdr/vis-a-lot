"use client";

import {
  type LucideIcon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
} from "lucide-react";
import type { LegendPosition } from "@/shared/api/types";
import { segmented } from "./segmented";

const s = segmented();

const POSITIONS = [
  { value: "top", label: "위", Icon: PanelTop },
  { value: "bottom", label: "아래", Icon: PanelBottom },
  { value: "left", label: "왼쪽", Icon: PanelLeft },
  { value: "right", label: "오른쪽", Icon: PanelRight },
] as const satisfies readonly {
  value: LegendPosition;
  label: string;
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
  return (
    <fieldset className={s.root()} aria-label="legend 위치">
      {POSITIONS.map(({ value: position, label, Icon }) => (
        <button
          key={position}
          type="button"
          className={s.item()}
          aria-pressed={position === value}
          disabled={disabled}
          onClick={() => position !== value && onSelect(position)}
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </fieldset>
  );
}
