"use client";

// 버튼 + 하나 고르는 목록 팝오버. 정렬 고르기, 일괄 변경 값 고르기에 쓴다.

import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Popover } from "@/shared/ui/Popover";
import { filterChip } from "./FilterBar";

const c = filterChip();

export type SingleOption<T> = { value: T; label: string };

export function SinglePick<T extends string | number | null>({
  label,
  value,
  options,
  onPick,
  showValue = true,
  disabled,
  width = 200,
  footer,
}: {
  label: string;
  value?: T;
  options: readonly SingleOption<T>[];
  onPick: (value: T) => void;
  /** 버튼에 고른 값을 함께 보인다 */
  showValue?: boolean;
  disabled?: boolean;
  width?: number;
  /** 목록 아래 덧붙이는 칸 (기한 입력 등). close를 받는다 */
  footer?: (close: () => void) => ReactNode;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      width={width}
      disabled={disabled}
      panelClassName="p-2"
      triggerClassName={c.trigger()}
      trigger={
        <span className="inline-flex min-w-0 items-center gap-1">
          {label}
          {showValue && current && (
            <span className={c.value()}>: {current.label}</span>
          )}
          <ChevronDown size={12} aria-hidden="true" />
        </span>
      }
    >
      {(close) => (
        <div>
          <p className="mb-1 px-1.5 text-2xs font-semibold text-fg-muted">
            {label}
          </p>
          <ul className={c.list()}>
            {options.map((o) => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  className={c.option({ class: "w-full text-left" })}
                  aria-current={o.value === value || undefined}
                  onClick={() => {
                    onPick(o.value);
                    close();
                  }}
                >
                  <span className="inline-grid w-3.5 flex-none place-items-center text-accent">
                    {o.value === value && (
                      <Check size={12} aria-hidden="true" />
                    )}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {footer?.(close)}
        </div>
      )}
    </Popover>
  );
}
