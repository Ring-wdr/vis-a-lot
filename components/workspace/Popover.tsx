"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import styles from "./Workspace.module.css";

/**
 * 네이티브 popover API(popovertarget)로 여닫는 팝오버. 바깥 클릭과 Esc 닫기는 브라우저가 처리하고,
 * 위치만 트리거 버튼 아래로 맞춘다.
 */
export function Popover({
  trigger,
  triggerClassName,
  triggerLabel,
  disabled,
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
          const width = 240;
          setPosition({
            top: rect.bottom + 6,
            left: Math.min(rect.left, window.innerWidth - width - 8),
          });
        }}
      >
        {trigger}
      </button>
      <div
        ref={ref}
        id={id}
        popover="auto"
        className={styles.popover}
        style={{ top: position.top, left: position.left }}
      >
        {children(() => ref.current?.hidePopover())}
      </div>
    </>
  );
}
