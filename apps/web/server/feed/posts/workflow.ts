// 게시물 상태 전이 규칙(순수 함수). transition·보드 드래그·일괄 변경·상세의 권한 표시가 같은 규칙을 쓴다.

import type { PostStatus } from "../db";

export type StatusCategory = "open" | "paused" | "closed";

/** 보드 열 순서이자 status 정렬 순서 */
export const STATUS_ORDER: PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "on_hold",
  "resolved",
  "cancelled",
];

export const STATUS_LABEL: Record<PostStatus, string> = {
  unresolved: "미해결",
  in_progress: "진행 중",
  in_review: "검토 중",
  on_hold: "보류",
  resolved: "해결됨",
  cancelled: "취소",
};

export function categoryOf(status: PostStatus): StatusCategory {
  if (status === "on_hold") return "paused";
  if (status === "resolved" || status === "cancelled") return "closed";
  return "open";
}

export function statusesOf(categories: StatusCategory[]): PostStatus[] {
  return STATUS_ORDER.filter((s) => categories.includes(categoryOf(s)));
}

export const OPEN_STATUSES = statusesOf(["open"]);
/** 닫힘 = 하위 진행률과 차단 해제에서 "끝난 것" */
export const CLOSED_STATUSES = statusesOf(["closed"]);

export const HOLD_REASONS = ["dependency", "decision", "resource"];
export const CANCEL_REASONS = [
  "duplicate",
  "cannot_reproduce",
  "out_of_scope",
  "low_priority",
];

/** 지금 사용자가 게시물에서 맡은 역할. admin은 그룹 관리자(시스템 관리자 포함) */
export type PostRoles = {
  author: boolean;
  assignee: boolean;
  requester: boolean;
  stakeholder: boolean;
  admin: boolean;
  /** 승인할 사람: 요청자, 요청자가 없으면 작성자 */
  reviewer: boolean;
};

export type TransitionKind =
  | "start"
  | "requestReview"
  | "approve"
  | "reject"
  | "hold"
  | "cancel"
  | "resume"
  | "reopen";

/** from → to가 어떤 전이인지. 규칙에 없으면 null (409) */
export function transitionKind(
  from: PostStatus,
  to: PostStatus,
): TransitionKind | null {
  const open = categoryOf(from) === "open";
  if (to === "on_hold") return open ? "hold" : null;
  if (to === "cancelled") return open ? "cancel" : null;
  switch (from) {
    case "unresolved":
      return to === "in_progress" ? "start" : null;
    case "in_progress":
      return to === "in_review" ? "requestReview" : null;
    case "in_review":
      if (to === "resolved") return "approve";
      return to === "in_progress" ? "reject" : null;
    case "on_hold":
      return to === "unresolved" ? "resume" : null;
    default:
      return to === "unresolved" ? "reopen" : null;
  }
}

/** transition(보드 드래그)으로 할 수 있는 전이. 반려는 댓글이 필요해 reject로만 한다 */
export function transitionViaMove(
  from: PostStatus,
  to: PostStatus,
): TransitionKind | null {
  const kind = transitionKind(from, to);
  return kind === "reject" ? null : kind;
}

export function canTransition(kind: TransitionKind, r: PostRoles): boolean {
  switch (kind) {
    case "start":
    case "requestReview":
      return r.assignee || r.admin;
    case "approve":
    case "reject":
      return r.reviewer || r.admin;
    case "hold":
    case "cancel":
    case "resume":
      return r.assignee || r.requester || r.author || r.admin;
    case "reopen":
      return r.requester || r.author || r.admin;
  }
}

/** 지금 사용자가 transition으로 옮길 수 있는 상태 */
export function reachableStatuses(
  from: PostStatus,
  roles: PostRoles,
): PostStatus[] {
  return STATUS_ORDER.filter((to) => {
    const kind = transitionViaMove(from, to);
    return kind !== null && canTransition(kind, roles);
  });
}

export function canEdit(r: PostRoles) {
  return r.author || r.assignee || r.requester || r.stakeholder || r.admin;
}

export function canDelete(r: PostRoles) {
  return r.author || r.admin;
}

/** 하위 비율 → 체크리스트 비율 → 수동(null). 하위가 있으면 하위가 먼저 */
export function autoProgress(
  children: { total: number; done: number },
  checklist: { total: number; done: number },
): number | null {
  const base = children.total > 0 ? children : checklist;
  if (base.total === 0) return null;
  return Math.round((100 * base.done) / base.total);
}
