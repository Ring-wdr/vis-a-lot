"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useDialogContainer } from "./Dialog";
import styles from "./Select.module.css";

export type SelectOption<T> = { value: T; label: string; disabled?: boolean };

/**
 * 단일 선택. 다중 선택(OrderedSelect)과 같은 트리거·팝업 모양을 쓴다.
 * 트리거가 native button이라 바깥 <fieldset disabled>에서도 함께 막힌다.
 */
export function Select<T extends string | number>({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  aside,
}: {
  label: string;
  /** 라벨 줄 오른쪽에 붙는 상태 (진행률 등). 새 줄을 만들지 않아 아래 필드를 밀지 않는다. */
  aside?: ReactNode;
  /** null이면 아직 고르지 않은 상태로 placeholder를 보여준다. */
  value: T | null;
  placeholder?: ReactNode;
  options: readonly SelectOption<T>[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  const dialog = useDialogContainer();
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
        <div className={styles.labelRow}>
          <BaseSelect.Label className={styles.label}>{label}</BaseSelect.Label>
          {aside}
        </div>
        <BaseSelect.Trigger className={styles.trigger}>
          <BaseSelect.Value
            className={styles.value}
            placeholder={
              <span className={styles.placeholder}>{placeholder}</span>
            }
          />
          <BaseSelect.Icon className={styles.chevron}>
            <ChevronDown size={14} aria-hidden="true" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        {/* dialog 안이면 dialog 안으로 portal하고, dialog의 스크롤 영역에 잘리지 않게 fixed로 띄운다. */}
        <BaseSelect.Portal container={dialog ?? undefined}>
          <BaseSelect.Positioner
            positionMethod={dialog ? "fixed" : undefined}
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
