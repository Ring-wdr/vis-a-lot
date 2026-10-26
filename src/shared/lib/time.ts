// 상세 화면의 시각 표시.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "방금", "5분 전", "3시간 전", "2일 전", 그보다 오래되면 날짜 */
export function relativeTime(iso: string, now = Date.now()) {
  const at = new Date(iso).getTime();
  const diff = now - at;
  if (diff < MINUTE) return "방금";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  return dateTime.format(at);
}
