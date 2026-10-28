// 활동 보고 기간. 날짜는 로컬 'YYYY-MM-DD'이고, 한 주는 월요일에 시작한다.

import { defineMessages, t } from "@/shared/lib/i18n";

export const PERIOD_PRESETS = [
  "this-week",
  "last-week",
  "7d",
  "month",
  "custom",
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const messages = defineMessages({
  ko: {
    preset: {
      "this-week": "이번 주",
      "last-week": "지난주",
      "7d": "최근 7일",
      month: "이번 달",
      custom: "직접 선택",
    } as Record<PeriodPreset, string>,
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
    dayHeading: (month: number, date: number, weekday: string) =>
      `${month}월 ${date}일 (${weekday})`,
    shortDay: (month: number, date: number, weekday: string) =>
      `${month}/${date}(${weekday})`,
  },
  en: {
    preset: {
      "this-week": "This week",
      "last-week": "Last week",
      "7d": "Last 7 days",
      month: "This month",
      custom: "Custom",
    },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayHeading: (month: number, date: number, weekday: string) =>
      `${weekday}, ${MONTHS[month - 1]} ${date}`,
    shortDay: (month: number, date: number, weekday: string) =>
      `${month}/${date} (${weekday})`,
  },
});

/** 기간 프리셋의 화면 이름 (지금 언어) */
export function periodLabel(preset: PeriodPreset) {
  return t(messages).preset[preset];
}

export const isPreset = (v: string | null): v is PeriodPreset =>
  !!v && (PERIOD_PRESETS as readonly string[]).includes(v);

const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isDay = (v: string | null): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && toDay(toDate(v)) === v;

export function addDays(day: string, n: number) {
  const d = toDate(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** from·to를 모두 넣은 날짜 수 */
export function spanDays(from: string, to: string) {
  return (
    Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1
  );
}

/** 프리셋 → 기간. 직접 선택은 오늘 하루를 기본으로 */
export function presetRange(preset: PeriodPreset, today: string) {
  const monday = addDays(today, -((toDate(today).getDay() + 6) % 7));
  switch (preset) {
    case "this-week":
      return { from: monday, to: today };
    case "last-week":
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "custom":
      return { from: today, to: today };
  }
}

/** '2026-10-22' → '10월 22일 (목)' */
export function dayHeading(day: string) {
  const text = t(messages);
  const d = toDate(day);
  return text.dayHeading(
    d.getMonth() + 1,
    d.getDate(),
    text.weekdays[d.getDay()],
  );
}

/** '2026-10-22' → '10/22(목)' (기간 표시용) */
export function shortDay(day: string) {
  const text = t(messages);
  const d = toDate(day);
  return text.shortDay(
    d.getMonth() + 1,
    d.getDate(),
    text.weekdays[d.getDay()],
  );
}
