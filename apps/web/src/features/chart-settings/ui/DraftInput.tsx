"use client";

import { cn } from "@vis-a-lot/shared/lib/tw";
import { useState } from "react";

const control =
  "w-full rounded-md border border-line bg-elevated px-1.5 py-1 text-fg";

/** 숫자 칸의 글자를 값으로. 비우면 null(자동, nullable일 때만), 잘못된 값이면 INVALID */
export const INVALID = Symbol("invalid");
export function parseNumber(
  text: string,
  field: { min: number; max: number; nullable?: boolean },
): number | null | typeof INVALID {
  const trimmed = text.trim();
  if (trimmed === "") return field.nullable ? null : INVALID;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return INVALID;
  return Math.min(field.max, Math.max(field.min, n));
}

/**
 * 입력한 글자는 그대로 두고, 값으로 읽히면 바로 폼에 넣는다. 입력 도중의 글자('1.', '-')를
 * 정리하지 않도록, 폼 값이 글자와 다르게 바뀌었을 때(되돌리기)만 글자를 따라 바꾼다.
 */
export function DraftInput({
  value,
  parse,
  onCommit,
  className,
  ...inputProps
}: {
  value: string;
  parse: (text: string) => unknown;
  onCommit: (value: unknown) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
>) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // 글자가 바뀔 때가 아니라 폼 값이 바뀔 때만 맞춘다.
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = parse(text);
    if (value !== (parsed === INVALID ? undefined : String(parsed ?? "")))
      setText(value);
  }

  return (
    <input
      {...inputProps}
      className={cn(control, className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const next = parse(e.target.value);
        if (next !== INVALID) onCommit(next);
      }}
    />
  );
}
