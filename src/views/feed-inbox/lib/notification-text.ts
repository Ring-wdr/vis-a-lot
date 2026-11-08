// 알림 한 줄의 문장. 알림 종류(배정·멘션 …)에 맞춰 받는 사람 입장에서 읽고, 나머지는 활동 로그 문장을 쓴다.

import { eventSentence } from "@/entities/post/lib/event-text";
import type { Notification, StatusNames } from "@/shared/api/feed/types";
import { defineMessages, t } from "@/shared/lib/i18n";

const messages = defineMessages({
  ko: {
    assigned: (actor: string) => `${actor}님이 담당자로 배정했습니다`,
    mentionComment: (actor: string) => `${actor}님이 댓글에서 멘션했습니다`,
    mentionBody: (actor: string) => `${actor}님이 설명에서 멘션했습니다`,
    comment: (actor: string) => `${actor}님이 댓글을 남겼습니다`,
    reviewRequested: (actor: string) => `${actor}님이 완료 승인을 요청했습니다`,
    holdResumed: "보류 재개일이 되어 미해결로 돌아왔습니다",
    childrenResolved: "하위 이슈가 모두 해결되어 검토 중이 되었습니다",
  },
  en: {
    assigned: (actor: string) => `${actor} assigned you`,
    mentionComment: (actor: string) => `${actor} mentioned you in a comment`,
    mentionBody: (actor: string) => `${actor} mentioned you in the description`,
    comment: (actor: string) => `${actor} commented`,
    reviewRequested: (actor: string) => `${actor} requested your approval`,
    holdResumed: "Hold ended; reopened as unresolved",
    childrenResolved: "All sub-issues resolved; now in review",
  },
});

export type NotificationTextContext = {
  userName: (id: string | null) => string;
  statusNames?: StatusNames;
};

export function notificationSentence(
  n: Notification,
  ctx: NotificationTextContext,
): string {
  const e = n.event;
  const text = t(messages);
  const actor = ctx.userName(e.actorId);
  switch (n.kind) {
    case "assigned":
      return text.assigned(actor);
    case "mention":
      return e.commentId ? text.mentionComment(actor) : text.mentionBody(actor);
    case "comment":
      return text.comment(actor);
    case "review_requested":
      return text.reviewRequested(actor);
    case "hold_resumed":
      return text.holdResumed;
    case "children_resolved":
      return text.childrenResolved;
    default:
      return eventSentence(e, ctx);
  }
}
