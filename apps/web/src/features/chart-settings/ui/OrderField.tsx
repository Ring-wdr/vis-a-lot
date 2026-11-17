"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useLingui } from "@lingui/react/macro";
import { useVirtualizer } from "@tanstack/react-virtual";
import { tv } from "@vis-a-lot/shared/lib/tw";
import { GripVertical } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { OrderSort } from "@/entities/chart/model/chart-options";
import { linkButton } from "@/shared/ui/button";
import "../config/messages";
import { moveInOrder, orderedList } from "../lib/order-list";

/** 줄 높이(h-7)와 같아야 가상 스크롤이 줄 자리를 맞게 계산한다. */
const ROW_HEIGHT = 28;

const orderField = tv({
  slots: {
    root: "flex flex-col gap-1 text-fg-secondary",
    head: "flex items-center justify-between gap-2",
    list: "max-h-56 touch-pan-y overflow-y-auto overscroll-contain rounded-md border border-line bg-elevated select-none",
    row: "data-dragging:z-raised absolute top-0 left-0 flex h-7 w-full cursor-grab items-center gap-1.5 border-y border-transparent px-1.5 text-left text-fg outline-none focus-visible:bg-accent-soft disabled:cursor-not-allowed disabled:text-fg-muted data-dragging:cursor-grabbing data-dragging:bg-panel data-dragging:shadow-md data-over-after:border-b-accent data-over-before:border-t-accent",
    grip: "size-3.5 flex-none text-fg-muted",
    pin: "inline-grid h-4 min-w-4 flex-none place-items-center rounded-full bg-accent px-1 text-3xs text-on-accent",
    note: "text-xs text-fg-muted",
  },
});

const s = orderField();

/**
 * 값 목록을 끌어서 순서를 정하는 필드(legend 순서·범주 순서). 저장한 순서(value)의 값을 앞에, 나머지를 sort 순으로
 * 늘어놓고, 끌거나 Alt+↑↓로 옮기면 목록 맨 위부터 마지막으로 옮긴 값까지를 onChange로 넘긴다.
 * `처음 순서로`는 빈 목록을 넘긴다. 값 목록은 여는 쪽이 받아 넘긴다(useOrderValues).
 */
export function OrderField({
  label,
  values,
  value,
  sort,
  onChange,
  disabled = false,
  tooMany = false,
  loading = false,
}: {
  label: string;
  /** 늘어놓을 값 전체. 받는 중이면 undefined */
  values: readonly string[] | undefined;
  /** 저장한 순서 (legend.order, axes.x.categoryOrder) */
  value: readonly string[];
  /** 나머지 값의 순서 (legend.sort, axes.x.categorySort) */
  sort: OrderSort;
  onChange: (order: string[]) => void;
  disabled?: boolean;
  /** 고유값이 너무 많아 순서를 정할 수 없다. 목록 대신 안내를 보인다. */
  tooMany?: boolean;
  loading?: boolean;
}) {
  const { t } = useLingui();
  const labelId = useId();
  const hintId = useId();
  const { list, pinned } = orderedList(values ?? [], value, sort);
  const listRef = useRef<HTMLDivElement>(null);
  /** 키보드로 옮긴 값. 다시 그린 뒤 그 줄로 포커스를 돌린다. */
  const [focusValue, setFocusValue] = useState<string | null>(null);
  const [over, setOver] = useState<{ value: string; after: boolean } | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const move = (from: number, to: number) => {
    if (disabled || from === to || to < 0 || to >= list.length) return;
    onChange(moveInOrder(list, pinned, from, to));
  };

  const index = list.indexOf(focusValue ?? "");
  useEffect(() => {
    if (focusValue === null || index < 0) return;
    virtualizer.scrollToIndex(index);
    // 가상 스크롤이 줄을 그린 뒤 포커스를 옮긴다.
    const frame = requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(
        `[data-index="${index}"]`,
      );
      row?.focus();
      setFocusValue(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusValue, index, virtualizer]);

  const onDragEnd = ({ active, over: target }: DragEndEvent) => {
    setOver(null);
    if (!target) return;
    move(list.indexOf(String(active.id)), list.indexOf(String(target.id)));
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const name = String(active.id);
      return t({
        message: `${name} 값을 집었습니다.`,
        comment: "{name}은 순서 필드에서 끄는 legend 값이나 범주",
      });
    },
    onDragOver: ({ over: target }) => {
      if (!target) return undefined;
      const place = String(target.id);
      return t({
        message: `${place} 자리`,
        comment: "{place}는 끄는 값을 놓을 자리에 있는 값",
      });
    },
    onDragEnd: ({ active, over: target }) => {
      if (!target) return t`놓을 자리가 없어 그대로 둡니다.`;
      const name = String(active.id);
      const place = String(target.id);
      return t({
        message: `${name} 값을 ${place} 자리에 놓았습니다.`,
        comment: "{name}은 옮긴 값, {place}는 놓은 자리에 있던 값",
      });
    },
    onDragCancel: () => t`옮기기를 취소했습니다.`,
  };

  return (
    <div className={s.root()}>
      <div className={s.head()}>
        <span id={labelId}>{label}</span>
        {value.length > 0 && (
          <button
            type="button"
            className={linkButton()}
            disabled={disabled}
            onClick={() => onChange([])}
          >
            {t({ message: "처음 순서로", context: "order field" })}
          </button>
        )}
      </div>
      {tooMany ? (
        <p className={s.note()}>
          {t`값이 너무 많아 순서를 정할 수 없습니다. 정렬만 고를 수 있습니다.`}
        </p>
      ) : loading || values === undefined ? (
        <p className={s.note()}>{t`값 목록을 받는 중입니다…`}</p>
      ) : list.length === 0 ? (
        <p className={s.note()}>{t`늘어놓을 값이 없습니다.`}</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragOver={({ active, over: target }) => {
            if (!target) return setOver(null);
            const from = list.indexOf(String(active.id));
            const to = list.indexOf(String(target.id));
            setOver(
              from === to
                ? null
                : { value: String(target.id), after: to > from },
            );
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => setOver(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable: t`끌어서 옮기거나 Alt+위·아래 화살표로 한 칸씩 옮깁니다.`,
            },
          }}
        >
          <div ref={listRef} className={s.list()}>
            {/* 전체 높이와 줄 위치는 가상 스크롤이 계산한 값이라 CSS로 정할 수 없다. */}
            <ul
              aria-labelledby={labelId}
              aria-describedby={hintId}
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((row) => {
                const item = list[row.index];
                return (
                  <OrderRow
                    key={item}
                    value={item}
                    index={row.index}
                    count={list.length}
                    start={row.start}
                    pinned={row.index < pinned ? row.index + 1 : undefined}
                    over={over?.value === item ? over : null}
                    disabled={disabled}
                    onMove={(to) => {
                      setFocusValue(item);
                      move(row.index, to);
                    }}
                  />
                );
              })}
            </ul>
          </div>
          <p id={hintId} className={s.note()}>
            {t`끌거나 Alt+↑↓로 옮깁니다. 옮긴 값까지 순서로 저장합니다.`}
          </p>
        </DndContext>
      )}
    </div>
  );
}

function OrderRow({
  value,
  index,
  count,
  start,
  pinned,
  over,
  disabled,
  onMove,
}: {
  value: string;
  index: number;
  count: number;
  /** 가상 스크롤이 정한 줄 위치(px) */
  start: number;
  /** 저장한 순서 안의 순번(1부터). 저장하지 않은 값이면 없다. */
  pinned: number | undefined;
  /** 끄는 값이 이 줄 위(앞)나 아래(뒤)에 놓일 자리 */
  over: { after: boolean } | null;
  disabled: boolean;
  onMove: (to: number) => void;
}) {
  const { t } = useLingui();
  const drag = useDraggable({ id: value, disabled });
  const drop = useDroppable({ id: value, disabled });
  const dy = drag.transform?.y ?? 0;
  const position = index + 1;
  return (
    <li>
      <button
        ref={(el) => {
          drag.setNodeRef(el);
          drop.setNodeRef(el);
        }}
        type="button"
        {...drag.attributes}
        {...drag.listeners}
        data-index={index}
        data-dragging={drag.isDragging || undefined}
        data-over-before={(over && !over.after) || undefined}
        data-over-after={over?.after || undefined}
        aria-roledescription={t`옮길 수 있는 값`}
        aria-label={t({
          message: `${value}, ${count}개 중 ${position}번째`,
          comment:
            "순서 필드의 값 하나. {value}는 값, {position}은 목록 안 순번",
        })}
        disabled={disabled}
        className={s.row()}
        // 줄 위치와 끄는 거리는 런타임 값이다.
        style={{ transform: `translateY(${start + dy}px)` }}
        onKeyDown={(e) => {
          if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown"))
            return;
          e.preventDefault();
          onMove(index + (e.key === "ArrowUp" ? -1 : 1));
        }}
      >
        <GripVertical className={s.grip()} aria-hidden="true" />
        <span className="flex-1 truncate">{value}</span>
        {pinned !== undefined && (
          <span className={s.pin()} aria-hidden="true">
            {pinned}
          </span>
        )}
      </button>
    </li>
  );
}
