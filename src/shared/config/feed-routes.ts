// 피드 화면 경로. 정적 export라 동적 부분은 query(?g=, ?key=, ?id=)로 받는다.

export const FEED = {
  home: "/feed",
  my: "/feed/my",
  list: "/feed/list",
  board: "/feed/board",
  view: "/feed/view",
  post: "/feed/post",
  new: "/feed/new",
  reportActivity: "/feed/report/activity",
  reportStatus: "/feed/report/status",
  inbox: "/feed/inbox",
  settingsNotifications: "/feed/settings/notifications",
  settingsGroup: "/feed/settings/group",
  admin: "/feed/admin",
  devOutbox: "/feed/dev/outbox",
  devSeed: "/feed/dev/seed",
  devClock: "/feed/dev/clock",
} as const;

/** 그룹 화면 경로: /feed/list?g=FD */
export const groupHref = (path: string, groupKey: string) =>
  `${path}?g=${encodeURIComponent(groupKey)}`;

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/**
 * 링크가 지금 화면인지. 경로가 같고, 링크에 g가 있으면 g도 같아야 한다.
 * g가 없는 링크(홈·내 작업 등)는 g가 붙어 있어도 경로만 본다.
 */
export function isCurrent(
  href: string,
  pathname: string,
  search: URLSearchParams,
) {
  const url = new URL(href, "http://x");
  if (trim(url.pathname) !== trim(pathname)) return false;
  const g = url.searchParams.get("g");
  return g === null || g === search.get("g");
}
