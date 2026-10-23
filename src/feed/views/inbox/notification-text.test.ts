import { describe, expect, it } from "vitest";
import type { Notification } from "@/feed/api/types";
import { notificationSentence } from "./notification-text";

const n = (
  kind: Notification["kind"],
  event: Partial<Notification["event"]> = {},
): Notification => ({
  id: "n1",
  kind,
  event: {
    id: "e1",
    postId: "p1",
    actorId: "u1",
    kind,
    field: null,
    oldValue: null,
    newValue: null,
    commentId: null,
    createdAt: "2026-10-23T00:00:00.000Z",
    ...event,
  },
  readAt: null,
  archivedAt: null,
  createdAt: "2026-10-23T00:00:00.000Z",
});

const names: Record<string, string> = { u1: "김지훈", u2: "이서연" };
const ctx = { userName: (id: string | null) => (id ? names[id] : "?") };

describe("알림 문장", () => {
  it("종류마다 받는 사람 입장의 문장", () => {
    expect(notificationSentence(n("assigned", { kind: "assignee" }), ctx)).toBe(
      "김지훈님이 담당자로 배정했습니다",
    );
    expect(notificationSentence(n("mention", { commentId: "c1" }), ctx)).toBe(
      "김지훈님이 댓글에서 멘션했습니다",
    );
    expect(notificationSentence(n("mention"), ctx)).toBe(
      "김지훈님이 설명에서 멘션했습니다",
    );
    expect(
      notificationSentence(
        n("status", { oldValue: "in_progress", newValue: "in_review" }),
        ctx,
      ),
    ).toBe("김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다");
    expect(
      notificationSentence(n("overdue", { newValue: "2026-10-20" }), ctx),
    ).toBe("기한(2026-10-20)이 지났습니다");
    expect(notificationSentence(n("rejected"), ctx)).toBe(
      "김지훈님이 반려했습니다",
    );
  });
});
