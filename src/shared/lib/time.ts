// 상세 화면의 시각 표시.

import { plural, t } from "@lingui/core/macro";
import { localeCached } from "@/shared/lib/i18n";
import "@/shared/config/messages";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 지금 언어의 날짜·시각 포매터. `dateTime().format(at)` */
export const dateTime = localeCached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
);

/** "방금", "5분 전", "3시간 전", "2일 전", 그보다 오래되면 날짜 */
export function relativeTime(iso: string, now = Date.now()) {
  const at = new Date(iso).getTime();
  const diff = now - at;
  if (diff < MINUTE) return t`방금`;
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return plural(minutes, { other: "#분 전" });
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return plural(hours, { other: "#시간 전" });
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return plural(days, { other: "#일 전" });
  }
  return dateTime().format(at);
}
