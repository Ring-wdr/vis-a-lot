// 피드 값의 화면 이름. 생성 타입의 enum으로 Record를 만들어, 서버에 값이 늘면 여기서 컴파일 오류가 난다.
// 표는 지금 언어(또는 넘긴 언어)로 읽는 함수다 (statusLabels()[s]). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다.
// 문구는 next-intl translator로 읽는다. 표 전체가 필요한 곳(필터·보드 열)이 많아 t.raw로 표째 꺼낸다.

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
import { getLocale, type Locale } from "@/shared/lib/i18n";
import { intlTranslator } from "@/shared/lib/intl";
import { defineIntlMessages } from "@/shared/lib/intl-messages";

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

const messages = defineIntlMessages({
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
  } satisfies Labels,
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

const translator = intlTranslator(messages);

/**
 * 표 하나를 지금 언어(또는 넘긴 언어)로 꺼낸다. next-intl의 t는 문구 하나("status.resolved")만 받으므로
 * 키마다 t로 읽어 표를 만들고 언어마다 한 번만 만든다. (t.raw는 문구 하나만 받아 표째 꺼낼 수 없다.)
 */
const tables = new Map<string, unknown>();
const table =
  <K extends keyof Labels>(key: K) =>
  (locale: Locale = getLocale()): Labels[K] => {
    const id = `${locale}:${key}`;
    let value = tables.get(id) as Labels[K] | undefined;
    if (!value) {
      const t = translator(locale);
      value = Object.fromEntries(
        Object.keys(messages.ko[key]).map((k) => [
          k,
          t(`${key}.${k}` as Parameters<typeof t>[0]),
        ]),
      ) as Labels[K];
      tables.set(id, value);
    }
    return value;
  };

export const statusLabels = table("status");

/** 보드 열·필터 순서 */
export const STATUSES: readonly PostStatus[] = [
  "unresolved",
  "in_progress",
  "in_review",
  "resolved",
  "on_hold",
  "cancelled",
];

export const categoryLabels = table("category");

export const priorityLabels = table("priority");

export const priorityLabel = (p: number, locale?: Locale) =>
  priorityLabels(locale)[p as PriorityLevel] ?? String(p);

export const formatLabels = table("format");

export const cancelReasonLabels = table("cancelReason");

export const holdReasonLabels = table("holdReason");

export const relationLabels = table("relation");

export const notifyKindLabels = table("notifyKind");

export const channelLabels = table("channel");

/** 그룹이 바꾼 상태 이름이 있으면 그것을, 없으면 기본 이름을 쓴다. */
export const statusLabel = (
  status: PostStatus,
  names?: StatusNames,
  locale?: Locale,
) => names?.[status] || statusLabels(locale)[status];
