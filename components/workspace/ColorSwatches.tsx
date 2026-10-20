"use client";

import { PALETTE } from "@/lib/palette";
import styles from "./Workspace.module.css";

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
  return (
    <div className={styles.swatches}>
      {PALETTE.map((c) => (
        <button
          key={c.hex}
          type="button"
          className={styles.swatch}
          style={{ background: c.hex }}
          aria-label={c.name}
          title={c.name}
          aria-pressed={c.hex.toLowerCase() === value.toLowerCase()}
          disabled={disabled}
          onClick={() => onSelect(c.hex)}
        />
      ))}
    </div>
  );
}
