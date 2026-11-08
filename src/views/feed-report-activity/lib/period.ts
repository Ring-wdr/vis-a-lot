// 활동 보고 기간. 날짜는 로컬 'YYYY-MM-DD'이고, 한 주는 월요일에 시작한다.

import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import { linguiFor } from "@/shared/lib/i18n";
import "../config/messages";

export const PERIOD_PRESETS = [
  "this-week",
  "last-week",
  "7d",
  "month",
  "custom",
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PRESET_LABELS: Record<PeriodPreset, MessageDescriptor> = {
  "this-week": msg`이번 주`,
  "last-week": msg`지난주`,
  "7d": msg`최근 7일`,
  month: msg`이번 달`,
  custom: msg`직접 선택`,
};

/** 요일 짧은 이름 (일요일부터). 한 글자라 다른 뜻과 갈리지 않게 context를 붙인다 */
const WEEKDAYS: MessageDescriptor[] = [
  msg({ message: "일", context: "short weekday: Sunday" }),
  msg({ message: "월", context: "short weekday: Monday" }),
  msg({ message: "화", context: "short weekday: Tuesday" }),
  msg({ message: "수", context: "short weekday: Wednesday" }),
  msg({ message: "목", context: "short weekday: Thursday" }),
  msg({ message: "금", context: "short weekday: Friday" }),
  msg({ message: "토", context: "short weekday: Saturday" }),
];

/** 날짜 머리의 달 이름 (1월부터) */
const MONTHS: MessageDescriptor[] = [
  msg({ message: "1월", context: "month in day heading" }),
  msg({ message: "2월", context: "month in day heading" }),
  msg({ message: "3월", context: "month in day heading" }),
  msg({ message: "4월", context: "month in day heading" }),
  msg({ message: "5월", context: "month in day heading" }),
  msg({ message: "6월", context: "month in day heading" }),
  msg({ message: "7월", context: "month in day heading" }),
  msg({ message: "8월", context: "month in day heading" }),
  msg({ message: "9월", context: "month in day heading" }),
  msg({ message: "10월", context: "month in day heading" }),
  msg({ message: "11월", context: "month in day heading" }),
  msg({ message: "12월", context: "month in day heading" }),
];

/** 기간 프리셋의 화면 이름 (지금 언어) */
export function periodLabel(preset: PeriodPreset) {
  return linguiFor()._(PRESET_LABELS[preset]);
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
  const i18n = linguiFor();
  const d = toDate(day);
  const month = i18n._(MONTHS[d.getMonth()]);
  const date = d.getDate();
  const weekday = i18n._(WEEKDAYS[d.getDay()]);
  return t({
    message: `${month} ${date}일 (${weekday})`,
    comment: "날짜 머리. month는 달 이름(10월, Oct), weekday는 요일 짧은 이름",
  });
}

/** '2026-10-22' → '10/22(목)' (기간 표시용) */
export function shortDay(day: string) {
  const d = toDate(day);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = linguiFor()._(WEEKDAYS[d.getDay()]);
  return t({
    message: `${month}/${date}(${weekday})`,
    comment: "기간 표시의 짧은 날짜. month는 달 숫자, weekday는 요일 짧은 이름",
  });
}
