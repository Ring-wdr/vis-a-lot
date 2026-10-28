// 피드 값의 화면 이름. 생성 타입의 enum으로 Record를 만들어, 서버에 값이 늘면 여기서 컴파일 오류가 난다.
// 표는 지금 언어(또는 넘긴 언어)로 읽는 함수다 (statusLabels()[s]). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다.

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
import { defineMessages, getLocale, type Locale } from "@/shared/lib/i18n";

/** 우선순위는 0~4 정수다. */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

type Labels = {
  status: Record<PostStatus, string>;
  category: Record<StatusCategory, string>;
  priority: Record<PriorityLevel, string>;
  format: Record<PostFormat, string>;
  cancelReason: Record<CancelReason, string>;
  holdReason: Record<HoldReason, string>;
  relation: Record<RelationKind, string>;
  notifyKind: Record<NotifyKind, string>;
  channel: Record<OutboxChannel | "inapp", string>;
};

const messages = defineMessages<Labels>({
  ko: {
    status: {
      unresolved: "미해결",
      in_progress: "진행 중",
      in_review: "검토 중",
      resolved: "해결됨",
      on_hold: "보류",
      cancelled: "취소",
    },
    category: { open: "열림", paused: "멈춤", closed: "닫힘" },
    priority: { 0: "없음", 1: "낮음", 2: "보통", 3: "높음", 4: "긴급" },
    format: { chart: "차트", image: "이미지", video: "동영상", code: "코드" },
    cancelReason: {
      duplicate: "중복",
      cannot_reproduce: "재현 안 됨",
      out_of_scope: "범위 밖",
      low_priority: "우선순위 낮음",
    },
    holdReason: {
      dependency: "의존성",
      decision: "의사결정",
      resource: "리소스 대기",
    },
    relation: {
      blocks: "차단",
      duplicate: "중복",
      relates: "관련",
      derived: "파생",
    },
    notifyKind: {
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
    },
    channel: { inapp: "앱 내", slack: "슬랙", email: "이메일" },
  },
  en: {
    status: {
      unresolved: "Unresolved",
      in_progress: "In progress",
      in_review: "In review",
      resolved: "Resolved",
      on_hold: "On hold",
      cancelled: "Cancelled",
    },
    category: { open: "Open", paused: "Paused", closed: "Closed" },
    priority: { 0: "None", 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" },
    format: { chart: "Chart", image: "Image", video: "Video", code: "Code" },
    cancelReason: {
      duplicate: "Duplicate",
      cannot_reproduce: "Can't reproduce",
      out_of_scope: "Out of scope",
      low_priority: "Low priority",
    },
    holdReason: {
      dependency: "Dependency",
      decision: "Decision",
      resource: "Awaiting resources",
    },
    relation: {
      blocks: "Blocks",
      duplicate: "Duplicate",
      relates: "Related",
      derived: "Derived",
    },
    notifyKind: {
      assigned: "Assigned",
      mention: "Mention",
      comment: "Comment",
      status: "Status change",
      review_requested: "Review request",
      approved: "Approved",
      rejected: "Rejected",
      due_soon: "Due soon",
      overdue: "Overdue",
      hold_resumed: "Hold resumed",
      unblocked: "Unblocked",
      children_resolved: "Sub-issues done",
    },
    channel: { inapp: "In-app", slack: "Slack", email: "Email" },
  },
});

export const statusLabels = (locale: Locale = getLocale()) =>
  messages[locale].status;

/** 보드 열·필터 순서 */
export const STATUSES: readonly PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "resolved",
  "on_hold",
  "cancelled",
];

export const categoryLabels = (locale: Locale = getLocale()) =>
  messages[locale].category;

export const priorityLabels = (locale: Locale = getLocale()) =>
  messages[locale].priority;

export const priorityLabel = (p: number, locale?: Locale) =>
  priorityLabels(locale)[p as PriorityLevel] ?? String(p);

export const formatLabels = (locale: Locale = getLocale()) =>
  messages[locale].format;

export const cancelReasonLabels = (locale: Locale = getLocale()) =>
  messages[locale].cancelReason;

export const holdReasonLabels = (locale: Locale = getLocale()) =>
  messages[locale].holdReason;

export const relationLabels = (locale: Locale = getLocale()) =>
  messages[locale].relation;

export const notifyKindLabels = (locale: Locale = getLocale()) =>
  messages[locale].notifyKind;

export const channelLabels = (locale: Locale = getLocale()) =>
  messages[locale].channel;

/** 그룹이 바꾼 상태 이름이 있으면 그것을, 없으면 기본 이름을 쓴다. */
export const statusLabel = (
  status: PostStatus,
  names?: StatusNames,
  locale?: Locale,
) => names?.[status] || statusLabels(locale)[status];
