import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * 늘 같은 함수로, 부를 때는 최신 콜백을 부른다.
 * throttle·이벤트 리스너·타이머처럼 한 번 만들어 두고 계속 쓰는 함수 안에서 props로 받은 콜백을 부를 때,
 * 콜백이 바뀔 때마다 그 함수를 다시 만들지 않아도 되게 한다.
 * 렌더 중에 부르면 직전 커밋의 콜백이 불리므로 이벤트·effect 안에서만 쓴다.
 */
export function useCallbackRef<A extends unknown[], R>(
  callback: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
