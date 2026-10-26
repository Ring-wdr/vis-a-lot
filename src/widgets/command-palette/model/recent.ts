// 팔레트에서 최근 고른 항목. 이 브라우저에만 남는 편의 기능이라 localStorage에 두고, 못 읽으면 빈 목록이다.

const KEY = "vis-a-lot.feed.palette-recent";
const MAX = 8;

export type RecentEntry = {
  /** 항목 id ('screen:board:FD', 'cmd:new', 'post:FD-12') */
  id: string;
  /** 게시물처럼 지금 목록에 없을 수 있는 항목의 이름 */
  label?: string;
};

export function loadRecent(): RecentEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (e): e is RecentEntry =>
            !!e && typeof e === "object" && typeof e.id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** 맨 앞에 넣고 같은 id는 뺀다 */
export function pushRecent(list: RecentEntry[], entry: RecentEntry) {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX);
}

export function saveRecent(entry: RecentEntry) {
  const next = pushRecent(loadRecent(), entry);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
