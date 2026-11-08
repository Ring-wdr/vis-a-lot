// 상세 화면의 시각 표시.

import { defineMessages, localeCached, t } from "@/shared/lib/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const messages = defineMessages({
  ko: {
    justNow: "방금",
    minutesAgo: (n: number) => `${n}분 전`,
    hoursAgo: (n: number) => `${n}시간 전`,
    daysAgo: (n: number) => `${n}일 전`,
  },
  en: {
    justNow: "just now",
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
  },
});

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
  const text = t(messages);
  const at = new Date(iso).getTime();
  const diff = now - at;
  if (diff < MINUTE) return text.justNow;
  if (diff < HOUR) return text.minutesAgo(Math.floor(diff / MINUTE));
  if (diff < DAY) return text.hoursAgo(Math.floor(diff / HOUR));
  if (diff < 7 * DAY) return text.daysAgo(Math.floor(diff / DAY));
  return dateTime().format(at);
}
