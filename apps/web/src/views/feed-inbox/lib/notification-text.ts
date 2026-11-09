// 알림 한 줄의 문장. 알림 종류(배정·멘션 …)에 맞춰 받는 사람 입장에서 읽고, 나머지는 활동 로그 문장을 쓴다.

import { t } from "@lingui/core/macro";
import { eventSentence } from "@/entities/post/lib/event-text";
import type { Notification, StatusNames } from "@/shared/api/feed/types";
import "../config/messages";

export type NotificationTextContext = {
  userName: (id: string | null) => string;
  statusNames?: StatusNames;
};

export function notificationSentence(
  n: Notification,
  ctx: NotificationTextContext,
): string {
  const e = n.event;
  const actor = ctx.userName(e.actorId);
  switch (n.kind) {
    case "assigned":
      return t`${actor}님이 담당자로 배정했습니다`;
    case "mention":
      return e.commentId
        ? t`${actor}님이 댓글에서 멘션했습니다`
        : t`${actor}님이 설명에서 멘션했습니다`;
    case "comment":
      return t`${actor}님이 댓글을 남겼습니다`;
    case "review_requested":
      return t`${actor}님이 완료 승인을 요청했습니다`;
    case "hold_resumed":
      return t`보류 재개일이 되어 미해결로 돌아왔습니다`;
    case "children_resolved":
      return t`하위 이슈가 모두 해결되어 검토 중이 되었습니다`;
    default:
      return eventSentence(e, ctx);
  }
}
