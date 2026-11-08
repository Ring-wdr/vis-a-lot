// 피드 값의 화면 이름. 생성 타입의 enum으로 Record를 만들어, 서버에 값이 늘면 여기서 컴파일 오류가 난다.
// 표는 지금 언어(또는 넘긴 언어)로 읽는 함수다 (statusLabels()[s]). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다.
// 문구는 Lingui msg 설명자로 두고, 언어마다 한 번 번역해 표로 만든다 (영어는 config/locales/en.po).

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
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
import { getLocale, type Locale, linguiFor } from "@/shared/lib/i18n";
import "../config/messages";

/** 우선순위는 0~4 정수다. */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

type Table<K extends PropertyKey> = Record<K, MessageDescriptor>;

const TABLES = {
  status: {
    unresolved: msg`미해결`,
    in_progress: msg`진행 중`,
    in_review: msg`검토 중`,
    resolved: msg`해결됨`,
    on_hold: msg`보류`,
    // "취소"는 다른 slice의 버튼 문구(Cancel)와 같은 원문이라 context로 id를 나눈다 (id는 원문+context로 만든다).
    cancelled: msg({ message: "취소", context: "post status" }),
  } satisfies Table<PostStatus>,
  category: {
    open: msg`열림`,
    paused: msg`멈춤`,
    closed: msg`닫힘`,
  } satisfies Table<StatusCategory>,
  priority: {
    0: msg`없음`,
    1: msg`낮음`,
    2: msg`보통`,
    3: msg`높음`,
    4: msg`긴급`,
  } satisfies Table<PriorityLevel>,
  format: {
    chart: msg`차트`,
    image: msg`이미지`,
    video: msg`동영상`,
    code: msg`코드`,
  } satisfies Table<PostFormat>,
  cancelReason: {
    duplicate: msg`중복`,
    cannot_reproduce: msg`재현 안 됨`,
    out_of_scope: msg`범위 밖`,
    low_priority: msg`우선순위 낮음`,
  } satisfies Table<CancelReason>,
  holdReason: {
    dependency: msg`의존성`,
    decision: msg`의사결정`,
    resource: msg`리소스 대기`,
  } satisfies Table<HoldReason>,
  relation: {
    blocks: msg`차단`,
    duplicate: msg`중복`,
    relates: msg`관련`,
    derived: msg`파생`,
  } satisfies Table<RelationKind>,
  notifyKind: {
    assigned: msg`배정`,
    mention: msg`멘션`,
    comment: msg`댓글`,
    status: msg`상태 변경`,
    review_requested: msg`완료 요청`,
    approved: msg`승인`,
    rejected: msg`반려`,
    due_soon: msg`기한 임박`,
    overdue: msg`기한 초과`,
    hold_resumed: msg`보류 재개`,
    unblocked: msg`차단 해제`,
    children_resolved: msg`하위 이슈 완료`,
  } satisfies Table<NotifyKind>,
  channel: {
    inapp: msg`앱 내`,
    slack: msg`슬랙`,
    email: msg`이메일`,
  } satisfies Table<OutboxChannel | "inapp">,
};

type Tables = typeof TABLES;
type Labels = { [T in keyof Tables]: Record<keyof Tables[T], string> };

/** 언어마다 한 번 번역한 표 */
const translated = new Map<Locale, Labels>();
function labels(locale: Locale): Labels {
  let value = translated.get(locale);
  if (!value) {
    const i18n = linguiFor(locale);
    value = Object.fromEntries(
      Object.entries(TABLES).map(([name, table]) => [
        name,
        Object.fromEntries(
          Object.entries(table).map(([k, d]) => [k, i18n._(d)]),
        ),
      ]),
    ) as Labels;
    translated.set(locale, value);
  }
  return value;
}

export const statusLabels = (locale: Locale = getLocale()) =>
  labels(locale).status;

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
  labels(locale).category;

export const priorityLabels = (locale: Locale = getLocale()) =>
  labels(locale).priority;

export const priorityLabel = (p: number, locale?: Locale) =>
  priorityLabels(locale)[p as PriorityLevel] ?? String(p);

export const formatLabels = (locale: Locale = getLocale()) =>
  labels(locale).format;

export const cancelReasonLabels = (locale: Locale = getLocale()) =>
  labels(locale).cancelReason;

export const holdReasonLabels = (locale: Locale = getLocale()) =>
  labels(locale).holdReason;

export const relationLabels = (locale: Locale = getLocale()) =>
  labels(locale).relation;

export const notifyKindLabels = (locale: Locale = getLocale()) =>
  labels(locale).notifyKind;

export const channelLabels = (locale: Locale = getLocale()) =>
  labels(locale).channel;

/** 그룹이 바꾼 상태 이름이 있으면 그것을, 없으면 기본 이름을 쓴다. */
export const statusLabel = (
  status: PostStatus,
  names?: StatusNames,
  locale?: Locale,
) => names?.[status] || statusLabels(locale)[status];
