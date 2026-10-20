"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import {
  type DragInput,
  type DragSession,
  IDLE,
  reduceDrag,
} from "./ordered-select-drag";

/** 이 안(px)이나 바깥으로 포인터가 가면 그 방향으로 자동 스크롤한다 */
const EDGE = 24;
/** 가장자리에 막 닿았을 때 / 가장 빠를 때 프레임당 스크롤 양(px) */
const MIN_SPEED = 2;
const MAX_SPEED = 40;

/**
 * listbox 위 mouse/pen 드래그로 순서대로 고르기. 판정은 listbox에 pointer capture를 잡고
 * clientY로 행 index를 계산한다(가상 스크롤에서 행 DOM이 재사용·제거돼도 흔들리지 않게).
 *
 * React Aria의 option은 usePress로 pointerdown에서 선택을 바꾸므로, mouse/pen pointerdown은
 * capture 단계에서 가로채 option까지 내려가지 않게 한다. touch는 그대로 두어 React Aria가
 * 탭 = 토글, 손가락 드래그 = 스크롤(pointercancel)로 처리하게 한다.
 */
export function useDragSelect<T>({
  listRef,
  keys,
  value,
  onChange,
  rowSize,
  padding,
  isBlocked,
}: {
  listRef: RefObject<HTMLElement | null>;
  /** 지금 보이는 목록(index → key) */
  keys: readonly T[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  rowSize: number;
  padding: number;
  isBlocked: () => boolean;
}) {
  const session = useRef<DragSession<T>>(IDLE);
  const pointerId = useRef<number | null>(null);
  const lastPoint = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  // 다시 그려지기 전에 이벤트가 연달아 와도 마지막으로 낸 값을 기준으로 계산한다
  const latest = useRef({ keys, value, onChange });
  latest.current = { keys, value, onChange };

  const indexAt = (clientY: number) => {
    const el = listRef.current;
    if (!el) return -1;
    const top = el.getBoundingClientRect().top + el.clientTop;
    // 목록 밖(위/아래)이면 가장자리 행으로 본다. 좌우로 나간 건 세로 위치만 본다.
    const y = Math.max(0, Math.min(el.clientHeight - 1, clientY - top));
    return Math.floor((y + el.scrollTop - padding) / rowSize);
  };

  /**
   * 누른 자리의 행 index. 스크롤바나 행이 없는 곳이면 -1.
   * e.target으로 option을 찾지 않는다: React Aria 가상 스크롤은 스크롤 중(끝나고 300ms까지) 내용에
   * pointer-events: none을 걸어서 그동안은 target이 listbox 자체가 된다.
   */
  const rowUnder = (el: HTMLElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left + el.clientLeft + el.clientWidth) return -1;
    const y = clientY - rect.top - el.clientTop + el.scrollTop - padding;
    const index = Math.floor(y / rowSize);
    return y < 0 || index >= latest.current.keys.length ? -1 : index;
  };

  const dispatch = (input: DragInput) => {
    const { keys, value, onChange } = latest.current;
    const result = reduceDrag(session.current, input, value, keys);
    session.current = result.session;
    if (result.value) {
      latest.current = { ...latest.current, value: result.value };
      onChange(result.value);
    }
  };

  const moveTo = (x: number, y: number) => {
    lastPoint.current = { x, y };
    dispatch({ type: "move", x, y, index: indexAt(y) });
  };

  const stopAutoScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  const autoScroll = () => {
    frame.current = 0;
    const el = listRef.current;
    if (!el || session.current.phase !== "dragging") return;
    const rect = el.getBoundingClientRect();
    const { x, y } = lastPoint.current;
    const fromTop = y - rect.top;
    const fromBottom = rect.bottom - y;
    // 가장자리에 가까울수록, 밖으로 멀리 나갈수록 빠르다
    const speed = (distance: number) =>
      Math.min(
        MAX_SPEED,
        MIN_SPEED + ((EDGE - distance) / EDGE) * (MAX_SPEED / 4),
      );
    let delta = 0;
    if (fromTop < EDGE) delta = -speed(fromTop);
    else if (fromBottom < EDGE) delta = speed(fromBottom);
    if (delta !== 0) {
      const before = el.scrollTop;
      el.scrollTop = before + delta;
      // 스크롤로 포인터 아래를 지나간 행도 채운다(건너뛴 행은 reducer가 구간으로 채운다)
      if (el.scrollTop !== before) moveTo(x, y);
    }
    frame.current = requestAnimationFrame(autoScroll);
  };

  const finish = (input: DragInput) => {
    stopAutoScroll();
    const el = listRef.current;
    const id = pointerId.current;
    pointerId.current = null;
    if (id !== null && el?.hasPointerCapture(id)) el.releasePointerCapture(id);
    dispatch(input);
  };

  // 드래그 중 Esc: 시작 전 값으로 되돌린다. 팝업 Esc 닫기나 React Aria의 키 처리보다 먼저 받아서 막는다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || session.current.phase === "idle") return;
      if (session.current.phase === "cancelled") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      stopAutoScroll();
      dispatch({ type: "escape" });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const isOwnPointer = (e: ReactPointerEvent) =>
    pointerId.current !== null && e.pointerId === pointerId.current;

  return {
    onPointerDownCapture(e: ReactPointerEvent<HTMLElement>) {
      if (isBlocked()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.pointerType === "touch" || e.button !== 0) return;
      if (pointerId.current !== null) return;
      const el = e.currentTarget;
      const index = rowUnder(el, e.clientX, e.clientY);
      if (index < 0) return;
      // option의 usePress까지 내려가면 pointerdown에서 선택이 바뀌므로 여기서 멈춘다
      e.stopPropagation();
      pointerId.current = e.pointerId;
      el.setPointerCapture(e.pointerId);
      lastPoint.current = { x: e.clientX, y: e.clientY };
      dispatch({ type: "down", x: e.clientX, y: e.clientY, index });
    },
    onMouseDownCapture(e: ReactMouseEvent<HTMLElement>) {
      // 검색 입력의 포커스를 지키고 텍스트 선택이 시작되지 않게 한다
      if (rowUnder(e.currentTarget, e.clientX, e.clientY) >= 0) {
        e.preventDefault();
      }
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      if (!isOwnPointer(e)) return;
      moveTo(e.clientX, e.clientY);
      if (session.current.phase === "dragging" && !frame.current) {
        frame.current = requestAnimationFrame(autoScroll);
      }
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      if (isOwnPointer(e)) finish({ type: "up" });
    },
    onPointerCancel(e: ReactPointerEvent<HTMLElement>) {
      if (isOwnPointer(e)) finish({ type: "abort" });
    },
    onLostPointerCapture(e: ReactPointerEvent<HTMLElement>) {
      if (isOwnPointer(e)) finish({ type: "abort" });
    },
    onScroll() {
      // 휠 등으로 스크롤돼도 포인터 아래 행이 바뀐 것으로 본다
      if (session.current.phase === "dragging") {
        moveTo(lastPoint.current.x, lastPoint.current.y);
      }
    },
  };
}
