"use client";

import { useSyncExternalStore } from "react";

/** 서버가 받는 배율의 상한. 서버도 이 이상은 낮춰 그린다. */
const MAX_PIXEL_RATIO = 3;

/** 화면의 devicePixelRatio를 0.25 단위로 맞춘 값 (1~3). 서버가 PNG를 이 배율로 촘촘하게 그린다. */
export function currentPixelRatio() {
  if (typeof window === "undefined") return 1;
  const ratio = Math.round((window.devicePixelRatio || 1) * 4) / 4;
  return Math.min(MAX_PIXEL_RATIO, Math.max(1, ratio));
}

/**
 * 배율이 지금 값에서 바뀌면 알린다 (창을 다른 모니터로 옮기거나 브라우저 확대·축소).
 * 확대·축소는 resize로도 오므로 함께 듣는다. 값이 같으면 useSyncExternalStore가 다시 그리지 않는다.
 */
function subscribe(onChange: () => void) {
  let query: MediaQueryList | undefined;
  const listen = () => {
    query?.removeEventListener("change", update);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener("change", update);
  };
  const update = () => {
    listen();
    onChange();
  };
  listen();
  window.addEventListener("resize", update);
  return () => {
    query?.removeEventListener("change", update);
    window.removeEventListener("resize", update);
  };
}

/** 화면 배율. 바뀌면 다시 렌더해 새 배율로 PNG를 요청하게 한다. */
export function usePixelRatio() {
  return useSyncExternalStore(subscribe, currentPixelRatio, () => 1);
}
