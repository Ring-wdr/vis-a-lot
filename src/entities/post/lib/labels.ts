// 피드 값의 화면 이름. 생성 타입의 enum으로 Record를 만들어, 서버에 값이 늘면 여기서 컴파일 오류가 난다.
// 표는 지금 언어(또는 넘긴 언어)로 읽는 함수다 (statusLabels()[s]). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다.
// 문구는 ./messages/{ko,en}.json (Paraglide, 키 post_<표>_<값>).

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
import { type Locale, messageTable } from "@/shared/lib/i18n";
import * as m from "@/shared/lib/paraglide/messages/_index.js";

/** 우선순위는 0~4 정수다. */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

export const statusLabels = messageTable<PostStatus>({
  unresolved: m.post_status_unresolved,
  in_progress: m.post_status_in_progress,
  in_review: m.post_status_in_review,
  resolved: m.post_status_resolved,
  on_hold: m.post_status_on_hold,
  cancelled: m.post_status_cancelled,
});

/** 보드 열·필터 순서 */
export const STATUSES: readonly PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "resolved",
  "on_hold",
  "cancelled",
];

export const categoryLabels = messageTable<StatusCategory>({
  open: m.post_category_open,
  paused: m.post_category_paused,
  closed: m.post_category_closed,
});

export const priorityLabels = messageTable<PriorityLevel>({
  0: m.post_priority_0,
  1: m.post_priority_1,
  2: m.post_priority_2,
  3: m.post_priority_3,
  4: m.post_priority_4,
});

export const priorityLabel = (p: number, locale?: Locale) =>
  priorityLabels(locale)[p as PriorityLevel] ?? String(p);

export const formatLabels = messageTable<PostFormat>({
  chart: m.post_format_chart,
  image: m.post_format_image,
  video: m.post_format_video,
  code: m.post_format_code,
});

export const cancelReasonLabels = messageTable<CancelReason>({
  duplicate: m.post_cancel_reason_duplicate,
  cannot_reproduce: m.post_cancel_reason_cannot_reproduce,
  out_of_scope: m.post_cancel_reason_out_of_scope,
  low_priority: m.post_cancel_reason_low_priority,
});

export const holdReasonLabels = messageTable<HoldReason>({
  dependency: m.post_hold_reason_dependency,
  decision: m.post_hold_reason_decision,
  resource: m.post_hold_reason_resource,
});

export const relationLabels = messageTable<RelationKind>({
  blocks: m.post_relation_blocks,
  duplicate: m.post_relation_duplicate,
  relates: m.post_relation_relates,
  derived: m.post_relation_derived,
});

export const notifyKindLabels = messageTable<NotifyKind>({
  assigned: m.post_notify_kind_assigned,
  mention: m.post_notify_kind_mention,
  comment: m.post_notify_kind_comment,
  status: m.post_notify_kind_status,
  review_requested: m.post_notify_kind_review_requested,
  approved: m.post_notify_kind_approved,
  rejected: m.post_notify_kind_rejected,
  due_soon: m.post_notify_kind_due_soon,
  overdue: m.post_notify_kind_overdue,
  hold_resumed: m.post_notify_kind_hold_resumed,
  unblocked: m.post_notify_kind_unblocked,
  children_resolved: m.post_notify_kind_children_resolved,
});

export const channelLabels = messageTable<OutboxChannel | "inapp">({
  inapp: m.post_channel_inapp,
  slack: m.post_channel_slack,
  email: m.post_channel_email,
});

/** 그룹이 바꾼 상태 이름이 있으면 그것을, 없으면 기본 이름을 쓴다. */
export const statusLabel = (
  status: PostStatus,
  names?: StatusNames,
  locale?: Locale,
) => names?.[status] || statusLabels(locale)[status];
