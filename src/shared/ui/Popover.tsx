"use client";

import { type ReactNode, useId, useState } from "react";
import { cn } from "@/shared/lib/tw";

/**
 * 네이티브 popover API(popovertarget)로 여닫는 팝오버. 바깥 클릭과 Esc 닫기는 브라우저가 처리하고,
 * 위치만 트리거 버튼 아래로 맞춘다.
 */
export function Popover({
  trigger,
  triggerClassName,
  triggerLabel,
  disabled,
  panelClassName,
  width = 240,
  onOpen,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  disabled?: boolean;
  panelClassName?: string;
  width?: number;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  // children은 렌더 중에 받으므로 ref 대신 id로 패널을 찾아 닫는다.
  const close = () => document.getElementById(id)?.hidePopover();

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        popoverTarget={id}
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={disabled}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onOpen?.();
          setPosition({
            top: rect.bottom + 6,
            left: Math.min(rect.left, window.innerWidth - width - 8),
          });
        }}
      >
        {trigger}
      </button>
      <div
        id={id}
        popover="auto"
        className={cn(
          "fixed inset-auto m-0 w-60 rounded-lg border border-line bg-elevated p-3 shadow-xl",
          panelClassName,
        )}
        style={{ top: position.top, left: position.left, width }}
      >
        {children(close)}
      </div>
    </>
  );
}
