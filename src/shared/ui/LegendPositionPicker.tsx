"use client";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import {
  type LucideIcon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
} from "lucide-react";
import type { LegendPosition } from "@/shared/api/types";
import { segmented } from "./segmented";
import "@/shared/config/messages";

const s = segmented();

const POSITIONS = [
  {
    value: "top",
    Icon: PanelTop,
    label: msg({ message: "위", context: "legend position" }),
  },
  {
    value: "bottom",
    Icon: PanelBottom,
    label: msg({ message: "아래", context: "legend position" }),
  },
  {
    value: "left",
    Icon: PanelLeft,
    label: msg({ message: "왼쪽", context: "legend position" }),
  },
  {
    value: "right",
    Icon: PanelRight,
    label: msg({ message: "오른쪽", context: "legend position" }),
  },
] as const satisfies readonly {
  value: LegendPosition;
  Icon: LucideIcon;
  label: MessageDescriptor;
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
  const { t, i18n } = useLingui();
  return (
    <fieldset className={s.root()} aria-label={t`legend 위치`}>
      {POSITIONS.map(({ value: position, Icon, label }) => (
        <button
          key={position}
          type="button"
          className={s.item()}
          aria-pressed={position === value}
          disabled={disabled}
          onClick={() => position !== value && onSelect(position)}
        >
          <Icon size={14} aria-hidden="true" />
          {i18n._(label)}
        </button>
      ))}
    </fieldset>
  );
}
