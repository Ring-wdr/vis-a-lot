"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useDialogContainer } from "./Dialog";
import { selectStyles } from "./select-styles";

const s = selectStyles();

export type SelectOption<T> = {
  value: T;
  label: string;
  disabled?: boolean;
  /** 라벨 앞 아이콘. 목록과 고른 값(트리거)에 함께 보인다. */
  icon?: ReactNode;
};

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
  const placeholderNode = (
    <span className={s.placeholder()}>{placeholder}</span>
  );
  // 아이콘이 있으면 트리거에도 아이콘과 라벨을 함께 그린다.
  const withIcons = options.some((o) => o.icon);
  return (
    <div className={s.field()}>
      <BaseSelect.Root
        items={options}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onChange(next as T);
        }}
      >
        <div className={s.labelRow()}>
          <BaseSelect.Label className={s.label()}>{label}</BaseSelect.Label>
          {aside}
        </div>
        <BaseSelect.Trigger className={s.trigger()}>
          <BaseSelect.Value className={s.value()} placeholder={placeholderNode}>
            {withIcons
              ? (current: T | null) => {
                  const o = options.find((x) => x.value === current);
                  if (!o) return placeholderNode;
                  return (
                    <span className={s.iconLabel()}>
                      <span className={s.icon()}>{o.icon}</span>
                      <span className={s.itemLabel()}>{o.label}</span>
                    </span>
                  );
                }
              : undefined}
          </BaseSelect.Value>
          <BaseSelect.Icon className={s.chevron()}>
            <ChevronDown size={14} aria-hidden="true" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        {/* dialog 안이면 dialog 안으로 portal하고, dialog의 스크롤 영역에 잘리지 않게 fixed로 띄운다. */}
        <BaseSelect.Portal container={dialog ?? undefined}>
          <BaseSelect.Positioner
            positionMethod={dialog ? "fixed" : undefined}
            className={s.positioner()}
            alignItemWithTrigger={false}
            align="start"
            sideOffset={4}
          >
            <BaseSelect.Popup className={s.popup()}>
              <BaseSelect.List>
                {options.map((o) => (
                  <BaseSelect.Item
                    key={String(o.value)}
                    value={o.value}
                    disabled={o.disabled}
                    className={s.item()}
                  >
                    <span className={s.check()}>
                      <BaseSelect.ItemIndicator>✓</BaseSelect.ItemIndicator>
                    </span>
                    {o.icon && <span className={s.icon()}>{o.icon}</span>}
                    <BaseSelect.ItemText className={s.itemLabel()}>
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
