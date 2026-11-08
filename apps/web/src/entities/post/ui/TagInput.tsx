"use client";

// 태그 입력: Enter나 쉼표로 더하고 x로 뺀다.

import { useLingui } from "@lingui/react/macro";
import { X } from "lucide-react";
import { useState } from "react";
import "../config/messages";
import { field } from "./styles";

export function TagInput({
  value,
  onChange,
  disabled = false,
  label: labelProp,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { t: tr } = useLingui();
  const label = labelProp ?? tr`태그`;
  // 기본 이름은 문장 전체를 한 메시지로 둔다 (영어는 소문자 "Add tags")
  const addLabel = labelProp ? tr`${labelProp} 더하기` : tr`태그 더하기`;
  const [text, setText] = useState("");
  const add = () => {
    const tags = text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    setText("");
    if (tags.length) onChange([...value, ...new Set(tags)]);
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={label}>
          {value.map((t) => (
            <li
              key={t}
              className="inline-flex h-6 items-center gap-0.5 rounded-full bg-panel pr-0.5 pl-2 text-xs text-fg-secondary"
            >
              #{t}
              {!disabled && (
                <button
                  type="button"
                  className="inline-grid size-5 cursor-pointer place-items-center rounded-full hover:bg-panel-strong"
                  aria-label={tr`태그 ${t} 빼기`}
                  onClick={() => onChange(value.filter((v) => v !== t))}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <input
          className={field()}
          value={text}
          placeholder={tr`태그 입력 후 Enter`}
          aria-label={addLabel}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  );
}
