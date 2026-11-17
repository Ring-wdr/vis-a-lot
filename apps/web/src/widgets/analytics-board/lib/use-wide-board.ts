import { useSyncExternalStore } from "react";

/** 레이아웃 트리로 칸을 놓는 폭. 이보다 좁으면 칸을 번호 순으로 한 줄로 쌓는다 (Tailwind `md`와 같다). */
const WIDE_QUERY = "(min-width: 48rem)";

const media = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_QUERY)
    : null;

function subscribe(onChange: () => void) {
  const query = media();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * 보드를 레이아웃 트리로 그릴 만큼 넓은지. 칸 자리를 인라인 스타일로 주므로 CSS 변형으로는 바꿀 수 없어
 * 화면 폭을 구독한다. 정적 HTML과 matchMedia가 없는 환경은 넓은 쪽으로 본다.
 */
export function useWideBoard() {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? true,
    () => true,
  );
}
