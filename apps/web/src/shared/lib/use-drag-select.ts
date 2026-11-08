"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  type DragState,
  dragPreview,
  dragReducer,
  IDLE,
  releaseValue,
} from "./drag-select";
import { useCallbackRef } from "./use-callback-ref";

/** 드래그 중 가장자리에서 이 거리 안이면 자동 스크롤한다. */
const EDGE = 24;
/** 자동 스크롤 최고 속도(px/frame). 가장자리 밖으로 멀어질수록 이 값에 가까워진다. */
const MAX_SCROLL_SPEED = 24;

/** step이 true를 돌려주는 동안 프레임마다 부른다. 예약한 프레임 id는 raf에 두고, 멈추면 0으로 비운다. */
function everyFrame(raf: { current: number }, step: () => boolean) {
  const tick = () => {
    raf.current = 0;
    if (step()) raf.current = requestAnimationFrame(tick);
  };
  raf.current = requestAnimationFrame(tick);
}

/**
 * 목록에 붙이는 드래그 선택 처리. 누른 채 훑으면 지나간 항목을 순서대로 고르거나 빼고,
 * 누르고 그대로 떼면 그 항목 하나를 토글한다. split by·tooltip 선택(OrderedSelect)과
 * 필터의 범주 값 목록이 같이 쓴다.
 *
 * - 판정은 pointer capture를 잡은 목록의 pointermove clientY로 항목 index를 계산한다.
 *   줄 높이가 고정이어야 하고, 가상 스크롤과 자동 스크롤에서도 index가 흔들리지 않는다.
 * - 각 줄에는 `data-index`(보이는 목록 기준 index)를 붙인다.
 * - 상태 계산은 `drag-select`의 순수 reducer가 맡는다.
 * - 드래그 중 Esc는 시작 전 값으로 되돌린다.
 */
export function useDragSelect<T>({
  listRef,
  value,
  visible,
  rowHeight,
  paddingStart = 0,
  isBlocked,
  onPreview,
  onCommit,
}: {
  listRef: RefObject<HTMLElement | null>;
  /** 지금 고른 값. 드래그 결과는 이 값에 지나간 구간을 더하거나 뺀 것이다. */
  value: readonly T[];
  /** 지금 보이는(검색으로 걸러진) 목록. data-index는 이 배열 기준이다. */
  visible: readonly T[];
  /** 고정 줄 높이(px) */
  rowHeight: number;
  /** 목록 맨 위 안쪽 여백(px) */
  paddingStart?: number;
  isBlocked: () => boolean;
  /** 드래그 중 미리 보기 값. 끝나면 null */
  onPreview: (preview: T[] | null) => void;
  /** 떼었을 때 확정할 값 */
  onCommit: (next: T[]) => void;
}) {
  const state = useRef<DragState<T>>(IDLE);
  const pointer = useRef({ id: -1, x: 0, y: 0 });
  const raf = useRef(0);
  const preview = useCallbackRef(onPreview);
  const commitValue = useCallbackRef(onCommit);
  // 콜백이 아닌 최신 값은 포인터 이벤트에서 읽도록 ref에 둔다.
  const latest = useRef({ value, visible });
  useEffect(() => {
    latest.current = { value, visible };
  });

  const setState = useCallback(
    (next: DragState<T>) => {
      if (next === state.current) return;
      state.current = next;
      preview(dragPreview(next));
    },
    [preview],
  );

  /** 포인터 세로 위치의 항목 index. 목록 밖(위/아래/좌우)이면 보이는 가장자리 항목으로 본다. */
  const indexAt = useCallback(
    (clientY: number) => {
      const el = listRef.current;
      if (!el) return -1;
      const top = el.getBoundingClientRect().top + el.clientTop;
      const y = Math.max(top, Math.min(top + el.clientHeight - 1, clientY));
      return Math.floor((y - top + el.scrollTop - paddingStart) / rowHeight);
    },
    [listRef, paddingStart, rowHeight],
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

  /** 포인터가 가장자리 근처에 있는 동안 프레임마다 목록을 스크롤한다. */
  const startAutoScroll = useCallback(
    () =>
      everyFrame(raf, () => {
        const el = listRef.current;
        const speed = scrollSpeed();
        if (!el || state.current.phase !== "dragging" || speed === 0)
          return false;
        el.scrollTop += speed;
        // 스크롤로 포인터 아래를 지나간 항목도 같은 규칙으로 채운다.
        moveTo();
        return true;
      }),
    [listRef, moveTo, scrollSpeed],
  );

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
      if (next) commitValue(next);
      const el = listRef.current;
      if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    },
    [listRef, setState, commitValue],
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
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
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
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
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
        startAutoScroll();
      }
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      if (isPointer(e)) finish(true);
    },
    onPointerCancel(e: ReactPointerEvent<HTMLElement>) {
      // touch 스크롤로 넘어가면 탭이 아니다. 드래그 중이었다면 지금까지를 확정한다.
      if (isPointer(e)) finish(state.current.phase === "dragging");
    },
    onLostPointerCapture(e: ReactPointerEvent<HTMLElement>) {
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
