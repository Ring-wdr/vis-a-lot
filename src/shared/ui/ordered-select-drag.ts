/**
 * OrderedSelect의 드래그 순서 선택 상태 계산. DOM을 모르는 순수 함수로 두고 단위 테스트한다.
 *
 * 핵심 규칙: 결과 = 드래그 시작 시점 값(base) + (시작 항목부터 현재 항목까지 연속 구간을 방문 방향 순서로 적용).
 * 매 이동마다 base에서 다시 계산하므로 빠르게 건너뛴 항목이 빠지지 않고, 되돌아오면 지나쳤던 변경이 되돌려진다.
 */

/** 이 거리 이상 움직이면 클릭이 아니라 드래그로 본다(px) */
export const DRAG_THRESHOLD = 4;

export type DragMode = "add" | "remove";

export type DragSession<T> =
  | { phase: "idle" }
  /** 주 버튼을 눌렀지만 아직 값을 바꾸지 않은 상태. 떼면 클릭 토글이 된다. */
  | { phase: "pending"; x: number; y: number; anchor: number }
  | {
      phase: "dragging";
      mode: DragMode;
      anchor: number;
      current: number;
      base: readonly T[];
      /** 드래그를 시작할 때의 보이는 목록. 드래그 중에 필터가 바뀌어도 판정은 이 목록 기준이다. */
      keys: readonly T[];
    }
  /** 드래그 중 Esc로 취소했다. 버튼을 뗄 때까지 이동은 무시한다. */
  | { phase: "cancelled" };

export type DragInput =
  | { type: "down"; x: number; y: number; index: number }
  | { type: "move"; x: number; y: number; index: number }
  | { type: "escape" }
  /** pointerup: pending이면 클릭 토글 */
  | { type: "up" }
  /** pointercancel / lostpointercapture: 드래그 중이면 그대로 확정하고, pending이면 아무것도 하지 않는다 */
  | { type: "abort" };

export type DragResult<T> = {
  session: DragSession<T>;
  /** 값이 바뀌었을 때만 들어간다 */
  value?: T[];
};

export const IDLE: DragSession<never> = { phase: "idle" };

/** 없으면 끝에 추가, 있으면 뺀다 */
export function toggleValue<T>(value: readonly T[], key: T): T[] {
  return value.includes(key) ? value.filter((v) => v !== key) : [...value, key];
}

/** base에 keys[anchor..current] 구간을 방문 방향 순서로 적용한다 */
export function applyDragRange<T>(
  base: readonly T[],
  keys: readonly T[],
  mode: DragMode,
  anchor: number,
  current: number,
): T[] {
  const step = current >= anchor ? 1 : -1;
  const touched: T[] = [];
  for (let i = anchor; ; i += step) {
    const key = keys[i];
    if (key !== undefined) touched.push(key);
    if (i === current) break;
  }
  if (mode === "remove") {
    const removed = new Set(touched);
    return base.filter((v) => !removed.has(v));
  }
  const next = [...base];
  const seen = new Set(base);
  for (const key of touched) {
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  return next;
}

function sameValue<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * 포인터 입력 하나를 반영한다. value는 지금 값, keys는 지금 보이는 목록(index → key).
 */
export function reduceDrag<T>(
  session: DragSession<T>,
  input: DragInput,
  value: readonly T[],
  keys: readonly T[],
): DragResult<T> {
  switch (input.type) {
    case "down":
      if (input.index < 0 || input.index >= keys.length) return { session };
      return {
        session: {
          phase: "pending",
          x: input.x,
          y: input.y,
          anchor: input.index,
        },
      };

    case "move": {
      if (session.phase === "pending") {
        const moved =
          Math.hypot(input.x - session.x, input.y - session.y) >=
          DRAG_THRESHOLD;
        if (!moved && input.index === session.anchor) return { session };
        // 모드는 시작 항목 기준. 시작 항목에 먼저 적용한다.
        const mode: DragMode = value.includes(keys[session.anchor] as T)
          ? "remove"
          : "add";
        const current = clampIndex(input.index, keys.length);
        const next = applyDragRange(value, keys, mode, session.anchor, current);
        return {
          session: {
            phase: "dragging",
            mode,
            anchor: session.anchor,
            current,
            base: value,
            keys,
          },
          value: next,
        };
      }
      if (session.phase === "dragging") {
        const current = clampIndex(input.index, session.keys.length);
        if (current === session.current) return { session };
        const next = applyDragRange(
          session.base,
          session.keys,
          session.mode,
          session.anchor,
          current,
        );
        return {
          session: { ...session, current },
          value: sameValue(next, value) ? undefined : next,
        };
      }
      return { session };
    }

    case "escape":
      if (session.phase === "dragging") {
        return {
          session: { phase: "cancelled" },
          value: sameValue(session.base, value) ? undefined : [...session.base],
        };
      }
      if (session.phase === "pending")
        return { session: { phase: "cancelled" } };
      return { session };

    case "up":
      if (session.phase === "pending") {
        const key = keys[session.anchor];
        return {
          session: IDLE,
          value: key === undefined ? undefined : toggleValue(value, key),
        };
      }
      return { session: IDLE };

    case "abort":
      return { session: IDLE };
  }
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}
