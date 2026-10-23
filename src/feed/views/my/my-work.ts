// 내 작업 탭과 필터. 홈의 요약 띠도 여기서 링크를 만든다.
// 기한 임박은 서버의 요약(posts.mySummary)과 같게: 담당 · 열림 · 기한이 오늘+3일까지(지난 것 포함).

import type { PostFilter, StatusCategory } from "@/feed/api/types";
import { FEED } from "@/feed/lib/routes";

export type MyTab = NonNullable<PostFilter["mine"]>;

export const MY_TABS: readonly { id: MyTab; label: string }[] = [
  { id: "assigned", label: "담당" },
  { id: "requested", label: "내가 요청" },
  { id: "review", label: "승인 대기" },
  { id: "stakeholder", label: "이해관계자" },
];

export const DUE_SOON_DAYS = 3;

export function parseTab(value: string | null): MyTab {
  return MY_TABS.find((t) => t.id === value)?.id ?? "assigned";
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
