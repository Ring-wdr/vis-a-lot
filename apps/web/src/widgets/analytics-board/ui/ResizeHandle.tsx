"use client";

import { useLingui } from "@lingui/react/macro";
import { cn } from "@vis-a-lot/shared/lib/tw";
import { useEffect, useRef } from "react";
import { moveDivider, RATIO_STEP } from "@/entities/workspace/lib/layout-tree";
import { holdSizes } from "@/shared/lib/size-hold";
import "../config/messages";
import { type Divider, dividerStyle } from "../lib/layout-rects";

/** 키 → 경계를 미는 몫. 손잡이 방향과 맞는 화살표만 쓴다. Home·End는 끝까지 민다. */
const KEY_DELTA: Record<Divider["direction"], Record<string, number>> = {
  horizontal: { ArrowLeft: -RATIO_STEP, ArrowRight: RATIO_STEP },
  vertical: { ArrowUp: -RATIO_STEP, ArrowDown: RATIO_STEP },
};
const HOME_END: Record<string, number> = { Home: -1, End: 1 };

const sameRatios = (a: readonly number[], b: readonly number[]) =>
  a.every((r, i) => Math.abs(r - b[i]) < 1e-9);

type Drag = {
  pointerId: number;
  start: number;
  /** split 길이(px) */
  length: number;
  next: readonly number[];
  /** 끄는 동안 칸 크기 쓰기를 미룬 것을 푼다 */
  release: () => void;
};

/**
 * split의 이웃 사이 경계 손잡이 (role="separator"). 끄는 동안에는 React 상태를 바꾸지 않고
 * onPreview로 보드가 DOM의 칸 자리만 바꾸게 하며, 놓을 때 onCommit으로 비율을 한 번 쓴다.
 * 화살표 키는 RATIO_STEP씩 옮겨 바로 쓴다. 한 칸은 MIN_RATIO보다 작아지지 않는다 (moveDivider).
 */
export function ResizeHandle({
  divider,
  disabledReason,
  onPreview,
  onCommit,
  ref,
}: {
  divider: Divider;
  /** 막혔으면(그리는 칸이 있다) 그 이유. title로 알린다. */
  disabledReason?: string;
  /** 끄는 동안의 비율. null이면 끌기를 그만둬 원래 자리로 돌린다. */
  onPreview: (divider: Divider, ratios: readonly number[] | null) => void;
  onCommit: (divider: Divider, ratios: readonly number[]) => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const { t } = useLingui();
  const drag = useRef<Drag | null>(null);
  const { direction, ratios, index } = divider;
  const row = direction === "horizontal";
  const disabled = disabledReason !== undefined;
  // 경계 앞쪽(왼쪽·위) 칸들의 몫. 경계의 자리를 split 안에서 %로 알린다.
  const before = ratios.slice(0, index + 1).reduce((a, b) => a + b, 0);
  const percent = Math.round(before * 100);

  // 끄는 중에 손잡이가 사라지면(최대화, 칸 삭제) 미룬 크기 쓰기를 푼다.
  useEffect(() => () => drag.current?.release(), []);

  const end = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (commit && !sameRatios(d.next, ratios)) onCommit(divider, d.next);
    else onPreview(divider, null);
    // 비율을 쓴 뒤에 풀어 칸들이 놓은 크기로 한 번만 다시 그리게 한다.
    d.release();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: 움직이는 경계(window splitter)는 포커스를 받는 separator라 hr로 쓸 수 없다
    <div
      ref={ref}
      role="separator"
      tabIndex={disabled ? -1 : 0}
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-disabled={disabled || undefined}
      aria-label={t`칸 크기 조절`}
      title={disabledReason ?? t`끌거나 화살표 키로 칸 크기를 바꿉니다`}
      className={cn(
        "group/divider z-raised absolute flex touch-none items-center justify-center outline-0",
        row
          ? "w-2 -translate-x-1/2 cursor-col-resize"
          : "h-2 -translate-y-1/2 cursor-row-resize",
        "aria-disabled:cursor-not-allowed",
      )}
      style={dividerStyle(divider)}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        const parent = e.currentTarget.parentElement?.getBoundingClientRect();
        const length = parent
          ? row
            ? parent.width * divider.box.width
            : parent.height * divider.box.height
          : 0;
        if (length <= 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = {
          pointerId: e.pointerId,
          start: row ? e.clientX : e.clientY,
          length,
          next: ratios,
          // 끄다가 잠깐 멈춰도 칸이 그 크기로 다시 그리지 않게 한다 (그리는 칸이 생기면 놓을 때 레이아웃이 잠긴다).
          release: holdSizes(),
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const delta = ((row ? e.clientX : e.clientY) - d.start) / d.length;
        d.next = moveDivider(ratios, index, delta);
        onPreview(divider, d.next);
      }}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(false)}
      onLostPointerCapture={() => end(true)}
      onKeyDown={(e) => {
        if (disabled) return;
        const delta = KEY_DELTA[direction][e.key] ?? HOME_END[e.key];
        if (delta === undefined) return;
        e.preventDefault();
        const next = moveDivider(ratios, index, delta);
        if (!sameRatios(next, ratios)) onCommit(divider, next);
      }}
    >
      {/* 보이는 선. 커서를 올리거나 포커스가 들어오면 강조한다. */}
      <span
        className={cn(
          "rounded-full",
          row ? "h-full w-0.5" : "h-0.5 w-full",
          !disabled &&
            "group-hover/divider:bg-accent-line group-focus-visible/divider:bg-accent",
        )}
      />
    </div>
  );
}
