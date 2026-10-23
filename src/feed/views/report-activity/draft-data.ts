// 활동 보고 → AI 초안 재료(ActivityData). 문장은 상세의 활동 로그와 같은 말(eventText)을 쓴다.

import type { ActivityData } from "@/feed/ai/types";
import type { ActivityReport } from "@/feed/api/reports";
import type { StatusNames } from "@/feed/api/types";
import { eventText } from "@/feed/views/post/event-text";

export function toActivityData(
  report: ActivityReport,
  userName: (id: string | null) => string,
  statusNames?: StatusNames,
): ActivityData {
  return {
    from: report.from,
    to: report.to,
    groupName: report.group.name,
    days: report.days.map((d) => ({
      date: d.date,
      entries: d.entries.map(({ event, post }) => ({
        actorName: userName(event.actorId),
        key: post.key,
        title: post.title,
        kind: event.kind,
        text: eventText(event, { userName, statusNames }),
      })),
    })),
    completed: report.completed.map((c) => ({
      key: c.post.key,
      title: c.post.title,
      assigneeName: c.assigneeId ? userName(c.assigneeId) : null,
    })),
  };
}
