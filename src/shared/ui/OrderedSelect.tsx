"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toggleValue } from "@/shared/lib/drag-select";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { useDragSelect } from "@/shared/lib/use-drag-select";
import { useDialogContainer } from "./Dialog";
import { selectStyles } from "./select-styles";

const s = selectStyles();

const messages = defineMessages({
  ko: {
    add: "추가…",
    trigger: (label: string, summary: string) =>
      `${label}: ${summary || "없음"}`,
    search: "검색",
    searchLabel: "옵션 검색",
    empty: "일치하는 항목이 없습니다",
    list: (label: string) => `${label} 옵션`,
  },
  en: {
    add: "Add…",
    trigger: (label: string, summary: string) =>
      `${label}: ${summary || "none"}`,
    search: "Search",
    searchLabel: "Search options",
    empty: "No matching items",
    list: (label: string) => `${label} options`,
  },
});

export type Option<T extends string> = { value: T; label: string };

/** 항목 높이를 고정해야 clientY만으로 포인터 아래 index를 바로 계산할 수 있다. */
const ROW_HEIGHT = 28;
const LIST_PADDING = 4;

/**
 * 고른 순서가 의미 있는 다중 선택. Base UI Combobox(multiple, 팝업 안 검색 입력)를 뼈대로 쓰고,
 * 목록은 @tanstack/react-virtual로 가상 스크롤한다.
 *
 * 포인터 선택(클릭/드래그/탭)은 Base UI의 item press 처리를 막고 listbox에서 직접 판정한다.
 * 키보드 Enter는 Base UI가 처리하고(끝에 추가 / 빼기), Space는 여기서 같은 토글을 붙인다.
 */
export function OrderedSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  options: readonly Option<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const text = useT(messages);
  const dialog = useDialogContainer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** 드래그 중 미리 보기 값. 확정(pointerup) 전까지 onChange를 부르지 않는다. */
  const [preview, setPreview] = useState<T[] | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /** 키보드로 강조한 항목. Space 토글 대상이다(마우스 hover 강조는 대상이 아니다). */
  const keyboardHighlight = useRef<T | null>(null);

  const shown = preview ?? value;
  const items = useMemo(
    () =>
      Combobox.createItems(options, {
        getValue: (o) => o.value,
        getLabel: (o) => o.label,
      }),
    [options],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
  }, [options, query]);
  const visible = useMemo(() => filtered.map((o) => o.value), [filtered]);
  const labelOf = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );
  /** 트리거에 보여 줄 고른 순서 그대로의 이름 목록 */
  const summary = shown.map((v) => labelOf.get(v) ?? v).join(", ");
  const orderOf = useMemo(
    () => new Map(shown.map((v, i) => [v, i + 1])),
    [shown],
  );

  /** disabled prop 또는 상위 <fieldset disabled> 안이면 막는다. */
  const isBlocked = useCallback(
    () => disabled || Boolean(triggerRef.current?.matches(":disabled")),
    [disabled],
  );

  const drag = useDragSelect({
    listRef,
    value,
    visible,
    rowHeight: ROW_HEIGHT,
    paddingStart: LIST_PADDING,
    isBlocked,
    onPreview: setPreview,
    onCommit: onChange,
  });

  const virtualizer = useVirtualizer({
    enabled: open,
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    paddingStart: LIST_PADDING,
    paddingEnd: LIST_PADDING,
    scrollPaddingStart: LIST_PADDING,
    scrollPaddingEnd: LIST_PADDING,
  });
  const setListElement = useCallback(
    (el: HTMLDivElement | null) => {
      listRef.current = el;
      if (el) virtualizer.measure();
    },
    [virtualizer],
  );
  const totalSize = virtualizer.getTotalSize();

  const toggle = (item: T) => {
    if (isBlocked() || drag.isActive()) return;
    onChange(toggleValue(value, item));
  };

  return (
    <div className={s.field()}>
      <span className={s.label()}>{label}</span>
      <Combobox.Root
        items={items}
        filteredItems={filtered}
        multiple
        virtualized
        disabled={disabled}
        value={shown}
        onValueChange={(next, details) => {
          // 포인터 press는 막아 두었으니 여기로 오는 건 키보드 Enter뿐이다.
          if (details.reason !== "item-press") return;
          if (isBlocked() || drag.isActive()) return;
          onChange(next);
        }}
        open={open}
        onOpenChange={(next, details) => {
          // 드래그 중에는 어떤 이유로도 닫지 않는다(규칙 10).
          if (!next && drag.isActive()) {
            details.cancel();
            return;
          }
          if (next && isBlocked()) {
            details.cancel();
            return;
          }
          setOpen(next);
        }}
        inputValue={query}
        onInputValueChange={(next, details) => {
          // 필터한 채로 여러 개를 고를 수 있게, 항목을 고를 때 검색어를 지우지 않는다.
          if (details.isItemPress) {
            details.cancel();
            return;
          }
          setQuery(next);
        }}
        onItemHighlighted={(item, { reason, index }) => {
          keyboardHighlight.current =
            reason === "keyboard" && item !== undefined ? item : null;
          if (reason === "keyboard" && index >= 0) {
            virtualizer.scrollToIndex(index, { align: "auto" });
          }
        }}
      >
        <div ref={anchorRef}>
          {/* 높이를 아끼려고 고른 값을 한 줄에 순서대로 이어 쓰고, 넘치면 말줄임으로 자른다.
              빼기는 목록에서 다시 누르거나 끌어서 한다. */}
          <Combobox.Trigger
            ref={triggerRef}
            className={s.trigger()}
            aria-label={text.trigger(label, summary)}
            title={summary || undefined}
          >
            <span
              className={cn(s.value(), shown.length === 0 && s.placeholder())}
            >
              {summary || (placeholder ?? text.add)}
            </span>
            {shown.length > 0 && (
              <span className={s.count()} aria-hidden="true">
                {shown.length}
              </span>
            )}
            <span className={s.chevron()}>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </Combobox.Trigger>
        </div>
        {/* dialog 안이면 dialog 안으로 portal한다 (Select와 같은 이유). */}
        <Combobox.Portal container={dialog ?? undefined}>
          <Combobox.Positioner
            positionMethod={dialog ? "fixed" : undefined}
            anchor={anchorRef}
            align="start"
            sideOffset={4}
            // 고를 때마다 칩 줄이 늘어 트리거 높이가 바뀐다. 따라가면 드래그 중 목록이 포인터 밑에서
            // 밀려 엉뚱한 항목이 판정되므로, 열려 있는 동안은 처음 위치에 둔다.
            disableAnchorTracking
            className="z-popover"
          >
            <Combobox.Popup
              className="w-[max(var(--anchor-width),13.75rem)] max-w-(--available-width) overflow-hidden rounded-lg border border-line bg-elevated text-ui text-fg shadow-lg"
              aria-label={label}
            >
              <Combobox.Input
                className="w-full border-b border-line px-2.5 py-2 outline-none"
                placeholder={text.search}
                aria-label={text.searchLabel}
                onKeyDown={(e) => {
                  // Space는 검색어 입력과 겹치므로 키보드로 강조한 항목이 있을 때만 토글로 쓴다.
                  if (e.key !== " " || keyboardHighlight.current === null) {
                    return;
                  }
                  e.preventDefault();
                  e.preventBaseUIHandler();
                  toggle(keyboardHighlight.current);
                }}
              />
              <Combobox.Empty className="not-empty:p-2.5 not-empty:text-xs not-empty:text-fg-muted">
                {text.empty}
              </Combobox.Empty>
              <Combobox.List
                ref={setListElement}
                aria-label={text.list(label)}
                className="max-h-70 touch-pan-y overflow-y-auto overscroll-contain outline-none select-none data-dragging:cursor-ns-resize"
                data-dragging={preview ? "" : undefined}
                hidden={filtered.length === 0}
                {...drag.listProps}
              >
                {/* 전체 높이와 줄 위치는 가상 스크롤이 계산한 값이라 CSS로 정할 수 없다. */}
                <div
                  role="presentation"
                  className="relative w-full"
                  style={{ height: totalSize }}
                >
                  {virtualizer.getVirtualItems().map((row) => {
                    const option = filtered[row.index];
                    if (!option) return null;
                    const order = orderOf.get(option.value);
                    return (
                      <Combobox.Item
                        key={option.value}
                        index={row.index}
                        value={option.value}
                        data-index={row.index}
                        // 높이는 ROW_HEIGHT와 같아야 포인터 위치로 줄을 계산할 수 있다.
                        className="absolute top-0 left-0 flex h-7 w-full cursor-default items-center gap-1.5 px-2 aria-selected:not-data-highlighted:bg-accent-soft data-highlighted:not-aria-selected:bg-panel aria-selected:data-highlighted:bg-accent-soft-strong"
                        aria-setsize={filtered.length}
                        aria-posinset={row.index + 1}
                        style={{ transform: `translateY(${row.start}px)` }}
                        // 포인터 선택은 listbox에서 직접 판정하므로 Base UI의 press 선택을 끈다.
                        // detail === 0인 click은 Base UI가 Enter 키로 보내는 것이라 그대로 둔다.
                        onClick={(e) => {
                          if (e.detail > 0) e.preventBaseUIHandler();
                        }}
                        onMouseUp={(e) => e.preventBaseUIHandler()}
                      >
                        <span
                          className="inline-grid size-3.5 flex-none place-items-center rounded-sm border border-line bg-elevated text-2xs text-accent"
                          aria-hidden="true"
                        >
                          {order !== undefined && "✓"}
                        </span>
                        <span className="flex-1 truncate">{option.label}</span>
                        {order !== undefined && (
                          <span
                            className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-3xs text-on-accent"
                            aria-hidden="true"
                          >
                            {order}
                          </span>
                        )}
                      </Combobox.Item>
                    );
                  })}
                </div>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
