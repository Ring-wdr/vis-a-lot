/**
 * 목록 위를 누른 채 훑어서 여러 항목을 순서대로 고르는 드래그 선택의 상태 계산.
 * DOM과 무관한 순수 함수라 포인터 처리 쪽은 "어느 index 위에 있는가"만 넘겨 준다.
 *
 * - 누르기만 하면 `pending`: 값은 아직 바꾸지 않는다. 그대로 떼면 클릭(토글)이다.
 * - 4px 이상 움직이거나 다른 항목으로 넘어가면 `dragging`. 모드는 시작 항목이 이미
 *   골라져 있었는지로 정한다(add / remove).
 * - 결과는 언제나 "시작 시점 값 + 시작 항목부터 현재 항목까지 연속 구간을 방문 방향 순서로
 *   적용"이다. 그래서 빠르게 건너뛴 항목도 빠지지 않고, 되돌아가면 지나친 변경이 풀린다.
 */

export type DragMode = "add" | "remove";

export type DragState<T> =
  | { phase: "idle" }
  | {
      phase: "pending";
      startIndex: number;
      x: number;
      y: number;
      /** false면(touch) 드래그로 넘어가지 않고, 많이 움직이면 탭도 취소한다. */
      allowDrag: boolean;
      base: readonly T[];
      visible: readonly T[];
    }
  | {
      phase: "dragging";
      mode: DragMode;
      startIndex: number;
      currentIndex: number;
      base: readonly T[];
      visible: readonly T[];
    };

export type DragAction<T> =
  | {
      type: "press";
      index: number;
      x: number;
      y: number;
      allowDrag: boolean;
      /** 누른 시점의 값. 드래그 결과와 Esc 되돌리기의 기준이 된다. */
      value: readonly T[];
      /** 지금 보이는(필터된) 목록. index는 이 배열 기준이다. */
      visible: readonly T[];
    }
  | { type: "move"; index: number; x: number; y: number }
  | { type: "cancel" }
  | { type: "end" };

/** 이만큼 움직이면 클릭이 아니라 드래그로 본다. */
export const DRAG_THRESHOLD = 4;
/** touch는 이만큼 움직이면 탭이 아니라 스크롤로 본다. */
export const TAP_SLOP = 10;

export const IDLE: DragState<never> = { phase: "idle" };

export function dragReducer<T>(
  state: DragState<T>,
  action: DragAction<T>,
): DragState<T> {
  switch (action.type) {
    case "press":
      return {
        phase: "pending",
        startIndex: action.index,
        x: action.x,
        y: action.y,
        allowDrag: action.allowDrag,
        base: action.value,
        visible: action.visible,
      };
    case "move": {
      if (state.phase === "pending") {
        const distance = Math.hypot(action.x - state.x, action.y - state.y);
        if (!state.allowDrag) return distance >= TAP_SLOP ? IDLE : state;
        if (distance < DRAG_THRESHOLD && action.index === state.startIndex) {
          return state;
        }
        const startValue = state.visible[state.startIndex];
        return {
          phase: "dragging",
          mode: state.base.includes(startValue) ? "remove" : "add",
          startIndex: state.startIndex,
          currentIndex: clampIndex(action.index, state.visible.length),
          base: state.base,
          visible: state.visible,
        };
      }
      if (state.phase === "dragging") {
        const index = clampIndex(action.index, state.visible.length);
        return index === state.currentIndex
          ? state
          : { ...state, currentIndex: index };
      }
      return state;
    }
    case "cancel":
    case "end":
      return IDLE;
  }
}

/** 드래그 중이면 지금 확정했을 때의 값, 아니면 null. */
export function dragPreview<T>(state: DragState<T>): T[] | null {
  if (state.phase !== "dragging") return null;
  return applyRange(
    state.base,
    state.visible,
    state.startIndex,
    state.currentIndex,
    state.mode,
  );
}

/**
 * 포인터를 뗐을 때 확정할 값. 드래그였으면 그 결과, 누르고 그대로 뗐으면(클릭/탭)
 * 시작 항목 토글, 그 밖에는 null(바꿀 것 없음).
 */
export function releaseValue<T>(state: DragState<T>): T[] | null {
  if (state.phase === "dragging") return dragPreview(state);
  if (state.phase === "pending") {
    return toggleValue(state.base, state.visible[state.startIndex]);
  }
  return null;
}

/** 없으면 끝에 추가, 있으면 뺀다. */
export function toggleValue<T>(value: readonly T[], item: T): T[] {
  return value.includes(item)
    ? value.filter((v) => v !== item)
    : [...value, item];
}

/** base에 visible[start..current] 연속 구간을 방문 방향 순서로 적용한다. */
export function applyRange<T>(
  base: readonly T[],
  visible: readonly T[],
  start: number,
  current: number,
  mode: DragMode,
): T[] {
  const step = current >= start ? 1 : -1;
  const range: T[] = [];
  for (let i = start; ; i += step) {
    range.push(visible[i]);
    if (i === current) break;
  }
  const baseSet = new Set(base);
  if (mode === "add") {
    return [...base, ...range.filter((v) => !baseSet.has(v))];
  }
  const removed = new Set(range);
  return base.filter((v) => !removed.has(v));
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}
