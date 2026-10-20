"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DragState,
  dragPreview,
  dragReducer,
  IDLE,
  releaseValue,
  toggleValue,
} from "@/shared/lib/drag-select";
import styles from "./OrderedSelect.module.css";

export type Option<T extends string> = { value: T; label: string };

/** 항목 높이를 고정해야 clientY만으로 포인터 아래 index를 바로 계산할 수 있다. */
const ROW_HEIGHT = 28;
const LIST_PADDING = 4;
const LIST_MAX_HEIGHT = 280;
/** 드래그 중 가장자리에서 이 거리 안이면 자동 스크롤한다. */
const EDGE = 24;
/** 자동 스크롤 최고 속도(px/frame). 가장자리 밖으로 멀어질수록 이 값에 가까워진다. */
const MAX_SCROLL_SPEED = 24;

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
  placeholder = "추가…",
  disabled = false,
}: {
  label: string;
  options: readonly Option<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
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
    <div className={styles.field}>
      <span>{label}</span>
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
        <div ref={anchorRef} className={styles.box}>
          {shown.length > 0 && (
            <ol className={styles.chips} aria-label={`${label} 순서`}>
              {shown.map((v, i) => (
                <li key={v} className={styles.chip}>
                  <span className={styles.chipOrder}>{i + 1}</span>
                  {labelOf.get(v) ?? v}
                  <button
                    type="button"
                    aria-label={`${labelOf.get(v) ?? v} 빼기`}
                    disabled={disabled}
                    onClick={() => {
                      if (isBlocked() || drag.isActive()) return;
                      onChange(value.filter((x) => x !== v));
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
          <Combobox.Trigger
            ref={triggerRef}
            className={styles.trigger}
            aria-label={`${label} 선택, ${shown.length}개 골라짐`}
          >
            <span className={styles.placeholder}>
              {shown.length === 0 ? placeholder : "추가"}
            </span>
            <ChevronIcon />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            anchor={anchorRef}
            align="start"
            sideOffset={4}
            // 고를 때마다 칩 줄이 늘어 트리거 높이가 바뀐다. 따라가면 드래그 중 목록이 포인터 밑에서
            // 밀려 엉뚱한 항목이 판정되므로, 열려 있는 동안은 처음 위치에 둔다.
            disableAnchorTracking
            className={styles.positioner}
          >
            <Combobox.Popup className={styles.popup} aria-label={label}>
              <Combobox.Input
                className={styles.search}
                placeholder="검색"
                aria-label="옵션 검색"
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
              <Combobox.Empty className={styles.empty}>
                일치하는 항목이 없습니다
              </Combobox.Empty>
              <Combobox.List
                ref={setListElement}
                aria-label={`${label} 옵션`}
                className={styles.list}
                data-dragging={preview ? "" : undefined}
                style={{
                  height: Math.min(LIST_MAX_HEIGHT, totalSize),
                  display: filtered.length === 0 ? "none" : undefined,
                }}
                {...drag.listProps}
              >
                <div
                  role="presentation"
                  className={styles.sizer}
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
                        className={styles.option}
                        aria-setsize={filtered.length}
                        aria-posinset={row.index + 1}
                        style={{
                          height: ROW_HEIGHT,
                          transform: `translateY(${row.start}px)`,
                        }}
                        // 포인터 선택은 listbox에서 직접 판정하므로 Base UI의 press 선택을 끈다.
                        // detail === 0인 click은 Base UI가 Enter 키로 보내는 것이라 그대로 둔다.
                        onClick={(e) => {
                          if (e.detail > 0) e.preventBaseUIHandler();
                        }}
                        onMouseUp={(e) => e.preventBaseUIHandler()}
                      >
                        <span className={styles.check} aria-hidden="true">
                          {order !== undefined && "✓"}
                        </span>
                        <span className={styles.optionLabel}>
                          {option.label}
                        </span>
                        {order !== undefined && (
                          <span className={styles.badge} aria-hidden="true">
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

/**
 * listbox에 붙이는 드래그 선택 처리. 판정은 pointer capture를 잡은 listbox의 pointermove clientY로
 * 항목 index를 계산한다(가상 스크롤과 자동 스크롤에서도 index가 흔들리지 않는다).
 * 상태 계산은 `drag-select`의 순수 reducer가 맡는다.
 */
function useDragSelect<T>({
  listRef,
  value,
  visible,
  isBlocked,
  onPreview,
  onCommit,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  value: readonly T[];
  visible: readonly T[];
  isBlocked: () => boolean;
  onPreview: (preview: T[] | null) => void;
  onCommit: (next: T[]) => void;
}) {
  const state = useRef<DragState<T>>(IDLE);
  const pointer = useRef({ id: -1, x: 0, y: 0 });
  const raf = useRef(0);
  const latest = useRef({ value, visible, onPreview, onCommit });
  useEffect(() => {
    latest.current = { value, visible, onPreview, onCommit };
  });

  const setState = useCallback((next: DragState<T>) => {
    if (next === state.current) return;
    state.current = next;
    latest.current.onPreview(dragPreview(next));
  }, []);

  /** 포인터 세로 위치의 항목 index. 목록 밖(위/아래/좌우)이면 보이는 가장자리 항목으로 본다. */
  const indexAt = useCallback(
    (clientY: number) => {
      const el = listRef.current;
      if (!el) return -1;
      const top = el.getBoundingClientRect().top + el.clientTop;
      const y = Math.max(top, Math.min(top + el.clientHeight - 1, clientY));
      return Math.floor((y - top + el.scrollTop - LIST_PADDING) / ROW_HEIGHT);
    },
    [listRef],
  );

  const moveTo = useCallback(() => {
    const { x, y } = pointer.current;
    setState(
      dragReducer(state.current, { type: "move", index: indexAt(y), x, y }),
    );
  }, [indexAt, setState]);

  /** 가장자리 24px 안이면 가까울수록, 밖이면 멀수록 빠르게. */
  const scrollSpeed = useCallback(() => {
    const el = listRef.current;
    if (!el) return 0;
    const top = el.getBoundingClientRect().top + el.clientTop;
    const bottom = top + el.clientHeight;
    const y = pointer.current.y;
    const depth =
      y < top + EDGE
        ? y - (top + EDGE)
        : y > bottom - EDGE
          ? y - (bottom - EDGE)
          : 0;
    if (depth === 0) return 0;
    const speed = Math.min(
      MAX_SCROLL_SPEED,
      Math.ceil((Math.abs(depth) / (EDGE * 2)) * MAX_SCROLL_SPEED),
    );
    return Math.sign(depth) * speed;
  }, [listRef]);

  const tick = useCallback(() => {
    raf.current = 0;
    const el = listRef.current;
    const speed = scrollSpeed();
    if (!el || state.current.phase !== "dragging" || speed === 0) return;
    el.scrollTop += speed;
    // 스크롤로 포인터 아래를 지나간 항목도 같은 규칙으로 채운다.
    moveTo();
    raf.current = requestAnimationFrame(tick);
  }, [listRef, moveTo, scrollSpeed]);

  const finish = useCallback(
    (commit: boolean) => {
      const prev = state.current;
      if (prev.phase === "idle") return;
      const pointerId = pointer.current.id;
      pointer.current.id = -1;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      setState(dragReducer(prev, { type: commit ? "end" : "cancel" }));
      const next = commit ? releaseValue(prev) : null;
      if (next) latest.current.onCommit(next);
      const el = listRef.current;
      if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    },
    [listRef, setState],
  );

  // 드래그 중 Esc: 시작 전 값으로 되돌리고 드래그만 끝낸다. Base UI의 Esc 닫기(document keydown)까지
  // 가지 않도록 window capture 단계에서 멈춘다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || state.current.phase === "idle") return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      cancelAnimationFrame(raf.current);
    };
  }, [finish]);

  const isPointer = (e: ReactPointerEvent) =>
    e.pointerId === pointer.current.id && state.current.phase !== "idle";

  const listProps = {
    onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      if (!e.isPrimary || isBlocked()) return;
      const touch = e.pointerType === "touch";
      if (!touch && e.button !== 0) return;
      const option = (e.target as Element).closest<HTMLElement>("[data-index]");
      if (!option || !e.currentTarget.contains(option)) return;
      if (!touch) {
        // 텍스트 선택과 검색 입력의 blur를 막고, 목록 밖으로 나가도 이벤트를 받는다.
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      setState(
        dragReducer(IDLE, {
          type: "press",
          index: Number(option.dataset.index),
          x: e.clientX,
          y: e.clientY,
          // touch는 손가락 드래그를 목록 스크롤로 남겨 둔다.
          allowDrag: !touch,
          value: latest.current.value,
          visible: latest.current.visible,
        }),
      );
    },
    onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      if (!isPointer(e)) return;
      if (e.pointerType !== "touch" && e.buttons === 0) {
        // 버튼이 이미 떼어졌는데 pointerup을 놓친 경우
        finish(true);
        return;
      }
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      moveTo();
      if (state.current.phase === "dragging" && !raf.current && scrollSpeed()) {
        raf.current = requestAnimationFrame(tick);
      }
    },
    onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
      if (isPointer(e)) finish(true);
    },
    onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
      // touch 스크롤로 넘어가면 탭이 아니다. 드래그 중이었다면 지금까지를 확정한다.
      if (isPointer(e)) finish(state.current.phase === "dragging");
    },
    onLostPointerCapture(e: ReactPointerEvent<HTMLDivElement>) {
      if (isPointer(e) && e.pointerType !== "touch") {
        finish(state.current.phase === "dragging");
      }
    },
    onScroll() {
      // 휠 등으로 드래그 중 스크롤해도 포인터 아래 항목을 따라간다.
      if (state.current.phase === "dragging") moveTo();
    },
  };

  return {
    listProps,
    isActive: () => state.current.phase !== "idle",
  };
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
