// 피드 값의 한국어 이름. 생성 타입의 enum으로 Record를 만들어, 서버에 값이 늘면 여기서 컴파일 오류가 난다.

import type {
  CancelReason,
  HoldReason,
  NotifyKind,
  OutboxChannel,
  PostFormat,
  PostStatus,
  RelationKind,
  StatusCategory,
  StatusNames,
} from "@/shared/api/feed/types";

export const STATUS_LABELS: Record<PostStatus, string> = {
  unresolved: "미해결",
  in_progress: "진행 중",
  in_review: "검토 중",
  resolved: "해결됨",
  on_hold: "보류",
  cancelled: "취소",
};

/** 보드 열·필터 순서 */
export const STATUSES = Object.keys(STATUS_LABELS) as PostStatus[];

export const CATEGORY_LABELS: Record<StatusCategory, string> = {
  open: "열림",
  paused: "멈춤",
  closed: "닫힘",
};

/** 우선순위는 0~4 정수다. */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  0: "없음",
  1: "낮음",
  2: "보통",
  3: "높음",
  4: "긴급",
};

export const priorityLabel = (p: number) =>
  PRIORITY_LABELS[p as PriorityLevel] ?? String(p);

export const FORMAT_LABELS: Record<PostFormat, string> = {
  chart: "차트",
  image: "이미지",
  video: "동영상",
  code: "코드",
};

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  duplicate: "중복",
  cannot_reproduce: "재현 안 됨",
  out_of_scope: "범위 밖",
  low_priority: "우선순위 낮음",
};

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  dependency: "의존성",
  decision: "의사결정",
  resource: "리소스 대기",
};

export const RELATION_LABELS: Record<RelationKind, string> = {
  blocks: "차단",
  duplicate: "중복",
  relates: "관련",
  derived: "파생",
};

export const NOTIFY_KIND_LABELS: Record<NotifyKind, string> = {
  assigned: "배정",
  mention: "멘션",
  comment: "댓글",
  status: "상태 변경",
  review_requested: "완료 요청",
  approved: "승인",
  rejected: "반려",
  due_soon: "기한 임박",
  overdue: "기한 초과",
  hold_resumed: "보류 재개",
  unblocked: "차단 해제",
  children_resolved: "하위 이슈 완료",
};

export const CHANNEL_LABELS: Record<OutboxChannel | "inapp", string> = {
  inapp: "앱 내",
  slack: "슬랙",
  email: "이메일",
};

/** 그룹이 바꾼 상태 이름이 있으면 그것을, 없으면 기본 이름을 쓴다. */
export const statusLabel = (status: PostStatus, names?: StatusNames) =>
  names?.[status] || STATUS_LABELS[status];
