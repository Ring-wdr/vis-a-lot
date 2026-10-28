// 상세 화면의 시각 표시. 문구는 ./messages/{ko,en}.json (Paraglide).

import { localeCached } from "@/shared/lib/i18n";
import * as m from "@/shared/lib/paraglide/messages/_index.js";

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
  if (diff < MINUTE) return m.time_just_now();
  if (diff < HOUR) return m.time_minutes_ago({ n: Math.floor(diff / MINUTE) });
  if (diff < DAY) return m.time_hours_ago({ n: Math.floor(diff / HOUR) });
  if (diff < 7 * DAY) return m.time_days_ago({ n: Math.floor(diff / DAY) });
  return m.time_date({ at });
}
