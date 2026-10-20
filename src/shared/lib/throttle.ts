/**
 * 처음 호출은 바로, 이후에는 wait마다 한 번만 부른다. 마지막 호출은 wait가 지난 뒤 반드시 부른다(trailing).
 * 스크롤처럼 짧은 시간에 수십 번 불리는 동작에서 비싼 일(서버 조회)을 몇 번으로 줄인다.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
) {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;

  const run = (args: A) => {
    last = Date.now();
    pending = undefined;
    fn(...args);
  };

  const throttled = (...args: A) => {
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0 && timer === undefined) {
      run(args);
      return;
    }
    pending = args;
    timer ??= setTimeout(
      () => {
        timer = undefined;
        if (pending) run(pending);
      },
      Math.max(0, remaining),
    );
  };

  throttled.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  return throttled;
}
