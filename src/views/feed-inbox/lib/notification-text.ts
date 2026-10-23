// 알림 한 줄의 문장. 알림 종류(배정·멘션 …)에 맞춰 받는 사람 입장에서 읽고, 나머지는 활동 로그 문장을 쓴다.

import { eventSentence } from "@/entities/post/lib/event-text";
import type { Notification, StatusNames } from "@/shared/api/feed/types";

export type NotificationTextContext = {
  userName: (id: string | null) => string;
  statusNames?: StatusNames;
};

export function notificationSentence(
  n: Notification,
  ctx: NotificationTextContext,
): string {
  const e = n.event;
  const actor = `${ctx.userName(e.actorId)}님이`;
  switch (n.kind) {
    case "assigned":
      return `${actor} 담당자로 배정했습니다`;
    case "mention":
      return `${actor} ${e.commentId ? "댓글" : "설명"}에서 멘션했습니다`;
    case "comment":
      return `${actor} 댓글을 남겼습니다`;
    case "review_requested":
      return `${actor} 완료 승인을 요청했습니다`;
    case "hold_resumed":
      return "보류 재개일이 되어 미해결로 돌아왔습니다";
    case "children_resolved":
      return "하위 이슈가 모두 해결되어 검토 중이 되었습니다";
    default:
      return eventSentence(e, ctx);
  }
}
