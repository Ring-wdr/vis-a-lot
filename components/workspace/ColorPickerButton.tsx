"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

/**
 * 네이티브 color picker를 여는 버튼.
 * React의 onChange는 고르는 도중의 input 이벤트마다 불리므로, 고르기를 마친 뒤의
 * 네이티브 change 이벤트만 받아 최종 색 하나로 서버에 요청한다.
 */
export function ColorPickerButton({
  color,
  label,
  onCommit,
  className,
  style,
  disabled,
  children,
}: {
  color: string;
  label: string;
  onCommit: (color: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onChange = () => {
      if (el.value.toLowerCase() !== color.toLowerCase())
        commit.current(el.value);
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [color]);

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          const el = input.current;
          if (!el) return;
          el.value = color;
          if (typeof el.showPicker === "function") el.showPicker();
          else el.click();
        }}
      >
        {children}
      </button>
      <input
        ref={input}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        defaultValue={color}
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none",
          ...(style ? { left: style.left, top: style.top } : {}),
        }}
      />
    </>
  );
}
