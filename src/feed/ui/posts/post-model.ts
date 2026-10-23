// 목록·보드가 함께 쓰는 순수 계산: 열 이름, 보드 상태 순서, 그룹 나누기, 기한 지남, 드래그 전이 고르기.

import type { PostStatus, PostSummary, ViewGroupBy } from "../../api/types";

export const POST_COLUMNS = [
  "key",
  "title",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "updatedAt",
  "thumbnail",
] as const;
export type PostColumn = (typeof POST_COLUMNS)[number];

export const COLUMN_LABELS: Record<PostColumn, string> = {
  key: "키",
  title: "제목",
  status: "상태",
  priority: "우선순위",
  assignee: "담당자",
  dueDate: "기한",
  updatedAt: "수정",
  thumbnail: "썸네일",
};

/** 리스트 기본 열 (썸네일은 끈다) */
export const DEFAULT_COLUMNS: readonly PostColumn[] = POST_COLUMNS.filter(
  (c) => c !== "thumbnail",
);

/** 보드 열 순서: 열림(미해결·진행 중·검토 중) → 멈춤(보류) → 닫힘(해결됨·취소) */
export const BOARD_STATUSES: readonly PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "on_hold",
  "resolved",
  "cancelled",
];

export const statusOrder = (s: PostStatus) => BOARD_STATUSES.indexOf(s);

/** 기한이 오늘보다 앞인 열린 게시물 */
export const isOverdue = (
  post: Pick<PostSummary, "dueDate" | "category">,
  today: string,
) => post.category === "open" && !!post.dueDate && post.dueDate < today;

export type PostGroup = { id: string; label: string; posts: PostSummary[] };

/** 그룹 안 순서는 들어온 순서(정렬 결과)를 그대로 둔다. 빈 그룹은 만들지 않는다. */
export function groupPosts(
  posts: readonly PostSummary[],
  groupBy: Exclude<ViewGroupBy, null>,
  names: {
    status: (s: PostStatus) => string;
    user: (id: string) => string;
    priority: (p: number) => string;
  },
): PostGroup[] {
  const buckets = new Map<string, PostSummary[]>();
  const idOf = (p: PostSummary) =>
    groupBy === "status"
      ? p.status
      : groupBy === "priority"
        ? String(p.priority)
        : (p.assigneeId ?? "");
  for (const p of posts) {
    const id = idOf(p);
    const list = buckets.get(id);
    if (list) list.push(p);
    else buckets.set(id, [p]);
  }
  const groups = [...buckets].map(([id, list]) => ({
    id,
    label:
      groupBy === "status"
        ? names.status(id as PostStatus)
        : groupBy === "priority"
          ? names.priority(Number(id))
          : id
            ? names.user(id)
            : "담당자 없음",
    posts: list,
  }));
  if (groupBy === "status")
    return groups.sort(
      (a, b) =>
        statusOrder(a.id as PostStatus) - statusOrder(b.id as PostStatus),
    );
  if (groupBy === "priority")
    return groups.sort((a, b) => Number(b.id) - Number(a.id));
  // 담당자: 이름순, 담당자 없음은 맨 끝
  return groups.sort((a, b) =>
    !a.id ? 1 : !b.id ? -1 : a.label.localeCompare(b.label, "ko"),
  );
}

export type Lane = { id: string; label: string; posts: PostSummary[] };

export const NO_TEAM = "none";

/** 팀 스윔레인: 그룹의 팀 순서대로, 팀 없는 게시물은 "팀 없음" 줄(있을 때만)에 */
export function teamLanes(
  posts: readonly PostSummary[],
  teams: readonly { id: string; name: string }[],
): Lane[] {
  const known = new Set(teams.map((t) => t.id));
  const lanes: Lane[] = teams.map((t) => ({
    id: t.id,
    label: t.name,
    posts: posts.filter((p) => p.teamId === t.id),
  }));
  const rest = posts.filter((p) => !p.teamId || !known.has(p.teamId));
  if (rest.length) lanes.push({ id: NO_TEAM, label: "팀 없음", posts: rest });
  return lanes;
}

export function byStatus(posts: readonly PostSummary[]) {
  const out = Object.fromEntries(
    BOARD_STATUSES.map((s) => [s, [] as PostSummary[]]),
  ) as Record<PostStatus, PostSummary[]>;
  for (const p of posts) out[p.status].push(p);
  return out;
}

/** 보드에서 from 열의 카드를 to 열에 놓았을 때 부를 API */
export type MoveKind =
  | "requestReview"
  | "approve"
  | "reject"
  | "hold"
  | "cancel"
  | "reopen"
  | "transition";

export function planMove(from: PostStatus, to: PostStatus): MoveKind | null {
  if (from === to) return null;
  if (to === "in_review") return "requestReview";
  if (to === "on_hold") return "hold";
  if (to === "cancelled") return "cancel";
  if (from === "in_review" && to === "resolved") return "approve";
  if (from === "in_review" && to === "in_progress") return "reject";
  if ((from === "resolved" || from === "cancelled") && to === "unresolved")
    return "reopen";
  return "transition";
}
