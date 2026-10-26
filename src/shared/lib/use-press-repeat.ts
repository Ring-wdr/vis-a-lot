"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";

/** 누르고 이만큼 지나면 계속 반복을 시작한다 */
const REPEAT_DELAY_MS = 350;
/** 이 간격으로 계속 반복한다 (Windows 스크롤바와 같은 감각) */
const REPEAT_INTERVAL_MS = 60;

/**
 * 누르고 있으면 계속 움직이는 버튼 (스크롤 화살표 같은).
 * `hold`를 onPointerDown에, `stop`을 onPointerUp·onPointerCancel에 단다.
 * 누르는 순간 `step`을 한 번 부르고, 잠시 뒤부터 `repeat`(없으면 `step`)를 간격마다 부른다.
 * 콜백이 false를 돌려주면(끝에 닿음) 멈춘다.
 */
export function usePressRepeat({
  delay = REPEAT_DELAY_MS,
  interval = REPEAT_INTERVAL_MS,
}: {
  delay?: number;
  interval?: number;
} = {}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    clearInterval(timer.current);
    timer.current = undefined;
  }, []);
  useEffect(() => stop, [stop]);

  const hold = useCallback(
    (
      e: ReactPointerEvent<HTMLElement>,
      step: () => boolean,
      repeat: () => boolean = step,
    ) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // 누른 채 버튼 밖으로 나가도 놓을 때 pointerup을 받는다.
      e.currentTarget.setPointerCapture(e.pointerId);
      stop();
      if (!step()) return;
      timer.current = setTimeout(() => {
        timer.current = setInterval(() => {
          if (!repeat()) stop();
        }, interval);
      }, delay);
    },
    [delay, interval, stop],
  );

  return { hold, stop };
}
