// 알림 설정 표의 값: 채널 순서, 이벤트 설명, 기본값(서버 server/feed/dispatch.ts의 defaultSetting과 같은 표).

import type { NotificationSetting, NotifyKind } from "@/shared/api/feed/types";

export const CHANNELS = ["inapp", "slack", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const KIND_DESCRIPTIONS: Record<NotifyKind, string> = {
  assigned: "나를 담당자로 정했을 때",
  mention: "댓글·설명에서 나를 @멘션했을 때",
  comment: "구독한 게시물에 댓글이 달렸을 때",
  status: "구독한 게시물의 상태가 바뀌었을 때",
  review_requested: "내가 승인할 게시물에 완료 요청이 왔을 때",
  approved: "내 게시물이 승인되었을 때",
  rejected: "내 게시물이 반려되었을 때",
  due_soon: "담당 게시물의 기한이 내일이거나 오늘일 때",
  overdue: "담당 게시물의 기한이 지났을 때",
  hold_resumed: "보류한 게시물이 재개일에 다시 열렸을 때",
  unblocked: "나를 막던 게시물이 닫혀 차단이 풀렸을 때",
  children_resolved: "하위 이슈가 모두 해결되어 검토할 차례일 때",
};

const SLACK_DEFAULT = new Set<NotifyKind>([
  "assigned",
  "mention",
  "review_requested",
  "rejected",
  "due_soon",
  "overdue",
]);

export function defaultSetting(kind: NotifyKind): NotificationSetting {
  return {
    kind,
    inapp: true,
    slack: SLACK_DEFAULT.has(kind),
    email: kind === "overdue",
  };
}

export const defaultSettings = (kinds: NotifyKind[]) =>
  kinds.map(defaultSetting);

export function sameSettings(
  a: NotificationSetting[],
  b: NotificationSetting[],
) {
  if (a.length !== b.length) return false;
  const byKind = new Map(b.map((s) => [s.kind, s]));
  return a.every((s) => {
    const o = byKind.get(s.kind);
    return (
      !!o && o.inapp === s.inapp && o.slack === s.slack && o.email === s.email
    );
  });
}
