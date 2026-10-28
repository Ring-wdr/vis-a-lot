// 내 작업 탭과 필터. 홈의 요약 띠도 여기서 링크를 만든다.
// 기한 임박은 서버의 요약(posts.mySummary)과 같게: 담당 · 열림 · 기한이 오늘+3일까지(지난 것 포함).

import type { PostFilter, StatusCategory } from "@/shared/api/feed/types";
import { FEED } from "@/shared/config/feed-routes";
import { defineMessages, t } from "@/shared/lib/i18n";

export type MyTab = NonNullable<PostFilter["mine"]>;

export const MY_TAB_IDS: readonly MyTab[] = [
  "assigned",
  "requested",
  "review",
  "stakeholder",
];

const messages = defineMessages<Record<MyTab, string>>({
  ko: {
    assigned: "담당",
    requested: "내가 요청",
    review: "승인 대기",
    stakeholder: "이해관계자",
  },
  en: {
    assigned: "Assigned",
    requested: "Requested",
    review: "To approve",
    stakeholder: "Stakeholder",
  },
});

/** 탭 목록 (지금 언어). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다 */
export const myTabs = (): readonly { id: MyTab; label: string }[] => {
  const labels = t(messages);
  return MY_TAB_IDS.map((id) => ({ id, label: labels[id] }));
};

export const DUE_SOON_DAYS = 3;

export function parseTab(value: string | null): MyTab {
  return MY_TAB_IDS.find((id) => id === value) ?? "assigned";
}

/** /feed/my?tab=…(&due=soon)(&closed=1) */
export function myWorkHref({
  tab,
  dueSoon = false,
  includeClosed = false,
}: {
  tab: MyTab;
  dueSoon?: boolean;
  includeClosed?: boolean;
}) {
  const q = new URLSearchParams({ tab });
  if (dueSoon) q.set("due", "soon");
  if (includeClosed) q.set("closed", "1");
  return `${FEED.my}?${q}`;
}

/** 'YYYY-MM-DD'에 날짜를 더한다 (로컬 달력 기준) */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** 지금(시계 오프셋 반영) 로컬 날짜 */
export function localToday(now: Date) {
  return addDays(
    `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
    0,
  );
}

const OPEN_ONLY: StatusCategory[] = ["open"];
const NOT_CLOSED: StatusCategory[] = ["open", "paused"];

/** 탭의 목록 필터. 기본은 열림·멈춤, includeClosed면 닫힌 것도 */
export function myFilter(
  tab: MyTab,
  opts: { includeClosed: boolean; dueSoonUntil?: string | null },
): PostFilter {
  if (opts.dueSoonUntil)
    return { mine: tab, categories: OPEN_ONLY, dueTo: opts.dueSoonUntil };
  return opts.includeClosed
    ? { mine: tab }
    : { mine: tab, categories: NOT_CLOSED };
}
