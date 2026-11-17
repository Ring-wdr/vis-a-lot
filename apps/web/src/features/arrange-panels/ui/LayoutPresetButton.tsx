"use client";

import { Popover } from "@base-ui/react/popover";
import type { MessageDescriptor } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import {
  LAYOUT_PRESETS,
  type LayoutPresetId,
  presetLayout,
} from "@/entities/workspace/lib/layout-presets";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import { button } from "@/shared/ui/button";
import "../config/messages";
import { matchingPreset } from "../lib/match-preset";
import {
  applyPresetWithConfirm,
  blockedReason,
  layoutBlock,
} from "../model/arrange";
import { LayoutThumb } from "./LayoutThumb";

/** 격자가 아닌 preset의 이름. 격자(R×C)는 id로 적는다. */
const SHAPE_NAMES: Partial<Record<LayoutPresetId, MessageDescriptor>> = {
  "left-big-2": msg`왼쪽 큰 칸 + 오른쪽 2칸`,
  "right-big-2": msg`오른쪽 큰 칸 + 왼쪽 2칸`,
  "top-big-2": msg`위 큰 칸 + 아래 2칸`,
  "bottom-big-2": msg`아래 큰 칸 + 위 2칸`,
  "left-big-3": msg`왼쪽 큰 칸 + 오른쪽 3칸`,
  "top-big-3": msg`위 큰 칸 + 아래 3칸`,
};

/** 칸 수별 묶음 (LAYOUT_PRESETS 순서 그대로) */
const GROUPS = [...new Set(LAYOUT_PRESETS.map((p) => p.panels))].map(
  (panels) => ({
    panels,
    presets: LAYOUT_PRESETS.filter((p) => p.panels === panels),
  }),
);

/** 작은 그림: 자리 번호를 칸 id로 쓴다. */
const THUMBS = Object.fromEntries(
  LAYOUT_PRESETS.map((p) => [
    p.id,
    presetLayout(
      p.id,
      Array.from({ length: p.panels }, (_, i) => String(i)),
    ),
  ]),
) as Record<LayoutPresetId, ReturnType<typeof presetLayout>>;

/** preset 하나를 고르는 그림 버튼 (표현) */
function PresetOption({
  id,
  name,
  current,
  onPick,
}: {
  id: LayoutPresetId;
  name: string;
  current: boolean;
  onPick: (id: LayoutPresetId) => void;
}) {
  return (
    <button
      type="button"
      className="flex h-10 w-14 cursor-pointer rounded-md border border-line bg-elevated p-1 hover:border-accent-line focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-accent-soft"
      aria-label={name}
      aria-pressed={current}
      title={name}
      onClick={() => onPick(id)}
    >
      <LayoutThumb node={THUMBS[id]} />
    </button>
  );
}

/**
 * 보드 도구 줄의 레이아웃 popover. preset 17개를 작은 그림으로 고른다. 지금 레이아웃과 같은 preset은 눌린 모양이다.
 * 그린 칸이 지워지면 먼저 확인을 받는다. 그리는 칸이 있으면 막고 이유를 title로 알린다.
 * 좁은 화면(48rem 미만)은 칸을 한 줄로 쌓아 레이아웃을 쓰지 않으므로 숨긴다.
 */
export function LayoutPresetButton({ className }: { className?: string }) {
  const { t, i18n } = useLingui();
  const board = useBoardStore();
  const blocked = useBoard(layoutBlock);
  const [open, setOpen] = useState(false);
  // 열 때만 지금 레이아웃과 견준다 (보드 레이아웃을 구독하지 않는다).
  const [current, setCurrent] = useState<LayoutPresetId>();

  const nameOf = (id: LayoutPresetId) => {
    const shape = SHAPE_NAMES[id];
    return shape ? i18n._(shape) : id.replace("x", "×");
  };

  const pick = (id: LayoutPresetId) => {
    setOpen(false);
    void applyPresetWithConfirm(board, id);
  };

  return (
    <Popover.Root
      open={open && !blocked}
      onOpenChange={(next) => {
        if (next) setCurrent(matchingPreset(board.getState().layout));
        setOpen(next);
      }}
    >
      <Popover.Trigger
        className={button({
          size: "sm",
          className: cn("max-md:hidden", className),
        })}
        disabled={blocked !== undefined}
        title={blocked ? blockedReason(blocked) : t`칸 배치를 고릅니다`}
      >
        <LayoutGrid size={14} aria-hidden="true" />
        <span className="whitespace-nowrap">
          <Trans>레이아웃</Trans>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-popover outline-0"
          align="start"
          sideOffset={4}
        >
          <Popover.Popup className="flex flex-col gap-2.5 rounded-lg border border-line bg-elevated p-3 text-ui shadow-xl outline-0">
            <Popover.Title className="text-2xs font-semibold text-fg-muted">
              <Trans>레이아웃</Trans>
            </Popover.Title>
            {GROUPS.map(({ panels, presets }) => (
              <fieldset
                key={panels}
                aria-label={t`${plural(panels, { other: "#칸" })}`}
                className="flex items-center gap-2"
              >
                <span
                  className="w-7 flex-none text-2xs text-fg-secondary tabular-nums"
                  aria-hidden="true"
                >
                  {t`${plural(panels, { other: "#칸" })}`}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <PresetOption
                      key={p.id}
                      id={p.id}
                      name={nameOf(p.id)}
                      current={p.id === current}
                      onPick={pick}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
