"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import styles from "./Select.module.css";

export type SelectOption<T> = { value: T; label: string; disabled?: boolean };

/**
 * 단일 선택. 다중 선택(OrderedSelect)과 같은 트리거·팝업 모양을 쓴다.
 * 트리거가 native button이라 바깥 <fieldset disabled>에서도 함께 막힌다.
 */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.field}>
      <BaseSelect.Root
        items={options}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onChange(next as T);
        }}
      >
        <BaseSelect.Label className={styles.label}>{label}</BaseSelect.Label>
        <BaseSelect.Trigger className={styles.trigger}>
          <BaseSelect.Value className={styles.value} />
          <BaseSelect.Icon className={styles.chevron}>
            <ChevronDown size={14} aria-hidden="true" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        <BaseSelect.Portal>
          <BaseSelect.Positioner
            className={styles.positioner}
            alignItemWithTrigger={false}
            align="start"
            sideOffset={4}
          >
            <BaseSelect.Popup className={styles.popup}>
              <BaseSelect.List>
                {options.map((o) => (
                  <BaseSelect.Item
                    key={String(o.value)}
                    value={o.value}
                    disabled={o.disabled}
                    className={styles.item}
                  >
                    <span className={styles.check}>
                      <BaseSelect.ItemIndicator>✓</BaseSelect.ItemIndicator>
                    </span>
                    <BaseSelect.ItemText className={styles.itemLabel}>
                      {o.label}
                    </BaseSelect.ItemText>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    </div>
  );
}
