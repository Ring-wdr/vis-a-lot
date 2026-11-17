// Focus 구역: 강조할 도형을 고른다. 방식은 셋이다.
//   condition  대상 값(x 또는 y) 연산자 값
//   rank       대상 값이 큰 쪽(top)·작은 쪽(bottom)에서 rankCount개. 경계 값과 같은 것은 모두 넣는다
//   range      rangeMin ≤ 대상 값 ≤ rangeMax. null인 쪽은 열려 있고, min > max면 맞는 것이 없다

import type { FocusOptions } from "../options";

export type FocusRule = Pick<
  FocusOptions,
  | "type"
  | "target"
  | "operator"
  | "value"
  | "rankFrom"
  | "rankCount"
  | "rangeMin"
  | "rangeMax"
>;

/** 대상 값으로 판정하는 함수. x, y는 도형의 대표 좌표다. */
export type FocusMatch = (x: number, y: number) => boolean;

const never: FocusMatch = () => false;

/** '='·'!='에서 같다고 보는 차이: 값 크기의 1e-9 (최소 1e-12) */
function nearlyEqual(a: number, b: number) {
  return (
    Math.abs(a - b) <=
    Math.max(1e-12, 1e-9 * Math.max(Math.abs(a), Math.abs(b)))
  );
}

function valueTest(
  operator: FocusOptions["operator"],
  value: number,
): (v: number) => boolean {
  switch (operator) {
    case ">":
      return (v) => v > value;
    case ">=":
      return (v) => v >= value;
    case "<":
      return (v) => v < value;
    case "<=":
      return (v) => v <= value;
    case "=":
      return (v) => nearlyEqual(v, value);
    case "!=":
      return (v) => !nearlyEqual(v, value);
  }
}

/**
 * values 중 큰 쪽에서 count번째 값 (count개보다 적으면 가장 작은 값). 크기 count인 최소 heap으로
 * O(n log count). 유한하지 않은 값과 include가 false인 자리는 뺀다. 값이 없으면 undefined
 */
export function rankBound(
  values: ArrayLike<number>,
  count: number,
  from: FocusOptions["rankFrom"],
  include?: (i: number) => boolean,
): number | undefined {
  const size = Math.max(1, Math.floor(count));
  // bottom은 부호를 뒤집어 같은 heap으로 센다.
  const sign = from === "top" ? 1 : -1;
  const heap: number[] = [];
  const down = (start: number) => {
    let i = start;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l] < heap[m]) m = l;
      if (r < heap.length && heap[r] < heap[m]) m = r;
      if (m === i) return;
      [heap[i], heap[m]] = [heap[m], heap[i]];
      i = m;
    }
  };
  for (let i = 0; i < values.length; i++) {
    if (include && !include(i)) continue;
    const raw = values[i];
    if (!Number.isFinite(raw)) continue;
    const v = raw * sign;
    if (heap.length < size) {
      // 위로 올린다.
      heap.push(v);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p] <= heap[k]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    } else if (v > heap[0]) {
      heap[0] = v;
      down(0);
    }
  }
  return heap.length === 0 ? undefined : heap[0] * sign;
}

/**
 * focus 판정 함수를 만든다. 순위는 xs·ys(그 item이 그리는 도형 전체의 대표 좌표)에서 경계 값을 먼저 구하고,
 * 조건·범위는 값만 본다. include가 있으면 false인 자리(끈 legend 값 등)는 순위에서 뺀다.
 */
export function focusMatcher(
  options: FocusRule,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  include?: (i: number) => boolean,
): FocusMatch {
  const byX = options.target === "x";
  const at = (test: (v: number) => boolean): FocusMatch =>
    byX ? (x) => test(x) : (_x, y) => test(y);
  switch (options.type) {
    case "rank": {
      const bound = rankBound(
        byX ? xs : ys,
        options.rankCount,
        options.rankFrom,
        include,
      );
      if (bound === undefined) return never;
      return at(
        options.rankFrom === "top" ? (v) => v >= bound : (v) => v <= bound,
      );
    }
    case "range": {
      const min = options.rangeMin ?? -Infinity;
      const max = options.rangeMax ?? Infinity;
      // 뒤집힌 범위는 맞는 것이 없다.
      if (min > max) return never;
      return at((v) => v >= min && v <= max);
    }
    default:
      return at(valueTest(options.operator, options.value));
  }
}
