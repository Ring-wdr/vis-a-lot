// Focus 구역: 조건(x 또는 y 연산자 값)에 맞는 점을 고른다.

import type { FocusOptions } from "../options";

/** '='·'!='에서 같다고 보는 차이: 값 크기의 1e-9 (최소 1e-12) */
function nearlyEqual(a: number, b: number) {
  return (
    Math.abs(a - b) <=
    Math.max(1e-12, 1e-9 * Math.max(Math.abs(a), Math.abs(b)))
  );
}

export function focusTest(
  options: Pick<FocusOptions, "target" | "operator" | "value">,
): (x: number, y: number) => boolean {
  const { value } = options;
  const pick =
    options.target === "x"
      ? (x: number, _y: number) => x
      : (_x: number, y: number) => y;
  switch (options.operator) {
    case ">":
      return (x, y) => pick(x, y) > value;
    case ">=":
      return (x, y) => pick(x, y) >= value;
    case "<":
      return (x, y) => pick(x, y) < value;
    case "<=":
      return (x, y) => pick(x, y) <= value;
    case "=":
      return (x, y) => nearlyEqual(pick(x, y), value);
    case "!=":
      return (x, y) => !nearlyEqual(pick(x, y), value);
  }
}
