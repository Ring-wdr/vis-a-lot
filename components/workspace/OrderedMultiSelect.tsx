"use client";

import styles from "./Workspace.module.css";

export type Option<T extends string> = { value: T; label: string };

/**
 * 클릭한 순서를 보장하는 다중 선택. 고른 값은 순서 번호가 붙은 칩으로 쌓이고,
 * 칩의 ×로 빼면 뒤의 순서가 앞으로 당겨진다.
 */
export function OrderedMultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "추가…",
}: {
  label: string;
  options: readonly Option<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
}) {
  const labelOf = new Map(options.map((o) => [o.value, o.label]));
  const remaining = options.filter((o) => !value.includes(o.value));

  return (
    <div className={styles.field}>
      <span>{label}</span>
      {value.length > 0 && (
        <ol className={styles.chips} aria-label={`${label} 순서`}>
          {value.map((v, i) => (
            <li key={v} className={styles.chip}>
              <span className={styles.chipOrder}>{i + 1}</span>
              {labelOf.get(v) ?? v}
              <button
                type="button"
                aria-label={`${labelOf.get(v) ?? v} 빼기`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      <select
        aria-label={`${label} 추가`}
        value=""
        disabled={remaining.length === 0}
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value as T]);
        }}
      >
        <option value="">{placeholder}</option>
        {remaining.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
