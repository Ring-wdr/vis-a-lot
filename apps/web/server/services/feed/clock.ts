// 피드의 "지금". /feed/dev/clock에서 앞뒤로 옮긴 시계 오프셋을 더한다 (기한 알림·보류 복귀를 바로 확인하는 장치).
// mock 서버는 페이지(main thread)에서 돌기 때문에 오프셋을 localStorage에 둔다.

const KEY = "vis-a-lot.feed.clock-offset-ms";

export function clockOffsetMs() {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function setClockOffsetMs(offsetMs: number) {
  try {
    if (offsetMs === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(offsetMs));
  } catch {}
}

export function feedNow() {
  return Date.now() + clockOffsetMs();
}
