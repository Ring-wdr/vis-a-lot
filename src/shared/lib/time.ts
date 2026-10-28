// 상세 화면의 시각 표시.

import { getLocale, type Locale } from "@/shared/lib/i18n";
import { intlFormat, intlTranslator } from "@/shared/lib/intl";
import { defineIntlMessages } from "@/shared/lib/intl-messages";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const messages = defineIntlMessages({
  ko: {
    justNow: "방금",
    minutesAgo: "{n, number}분 전",
    hoursAgo: "{n, number}시간 전",
    daysAgo: "{n, number}일 전",
  },
  en: {
    justNow: "just now",
    minutesAgo: "{n, number}m ago",
    hoursAgo: "{n, number}h ago",
    daysAgo: "{n, number}d ago",
  },
});

const translator = intlTranslator(messages);

/** 지금 언어의 날짜·시각 포매터. `dateTime().format(at)` */
export const dateTime = (locale: Locale = getLocale()) => ({
  format: (at: Date | number) =>
    intlFormat(locale).dateTime(at, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
});

/** "방금", "5분 전", "3시간 전", "2일 전", 그보다 오래되면 날짜 */
export function relativeTime(iso: string, now = Date.now()) {
  const t = translator();
  const at = new Date(iso).getTime();
  const diff = now - at;
  if (diff < MINUTE) return t("justNow");
  if (diff < HOUR) return t("minutesAgo", { n: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t("hoursAgo", { n: Math.floor(diff / HOUR) });
  if (diff < 7 * DAY) return t("daysAgo", { n: Math.floor(diff / DAY) });
  return dateTime().format(at);
}
