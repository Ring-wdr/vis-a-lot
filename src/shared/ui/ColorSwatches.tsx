"use client";

import { useLocale } from "@/shared/lib/i18n";
import { colorName, PALETTE } from "@/shared/lib/palette";

/** 팔레트 색 고르기. 선택한 색은 aria-pressed로 표시한다. */
export function ColorSwatches({
  value,
  onSelect,
  disabled = false,
}: {
  value: string;
  onSelect: (hex: string) => void;
  disabled?: boolean;
}) {
  useLocale();
  return (
    // 팔레트는 1fr 칸이라 늘리지 않으면 내용 폭(0)으로 줄어 색이 테두리에 가려진다.
    <div className="grid max-w-72 grid-cols-8 gap-1.5 self-stretch">
      {PALETTE.map((c) => (
        <button
          key={c.hex}
          type="button"
          className="aspect-square cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-fg"
          style={{ background: c.hex }}
          aria-label={colorName(c.hex)}
          title={colorName(c.hex)}
          aria-pressed={c.hex.toLowerCase() === value.toLowerCase()}
          disabled={disabled}
          onClick={() => onSelect(c.hex)}
        />
      ))}
    </div>
  );
}
