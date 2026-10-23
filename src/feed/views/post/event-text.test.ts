import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/feed/api/types";
import { eventSentence, josa } from "./event-text";
import { relativeTime } from "./time";

const ev = (patch: Partial<FeedEvent>): FeedEvent => ({
  id: "e1",
  postId: "p1",
  actorId: "u1",
  kind: "created",
  field: null,
  oldValue: null,
  newValue: null,
  commentId: null,
  createdAt: "2026-10-23T00:00:00.000Z",
  ...patch,
});

const names: Record<string, string> = { u1: "김지훈", u2: "이서연" };
const ctx = { userName: (id: string | null) => (id ? names[id] : "?") };

describe("활동 로그 문장", () => {
  it("조사", () => {
    expect(josa("검토 중", "으로/로")).toBe("검토 중으로");
    expect(josa("미해결", "으로/로")).toBe("미해결로");
    expect(josa("보통", "으로/로")).toBe("보통으로");
    expect(josa("높음", "으로/로")).toBe("높음으로");
    expect(josa("FD-3", "을/를")).toBe("FD-3을");
    expect(josa("FD-2", "과/와")).toBe("FD-2와");
    expect(josa("FD-7", "으로/로")).toBe("FD-7로");
  });

  it("상태·담당자·우선순위", () => {
    expect(
      eventSentence(
        ev({ kind: "status", oldValue: "in_progress", newValue: "in_review" }),
        ctx,
      ),
    ).toBe("김지훈님이 상태를 진행 중 → 검토 중으로 바꿨습니다");
    expect(
      eventSentence(
        ev({ kind: "status", oldValue: "in_review", newValue: "resolved" }),
        { ...ctx, statusNames: { resolved: "완료" } },
      ),
    ).toBe("김지훈님이 상태를 검토 중 → 완료로 바꿨습니다");
    expect(eventSentence(ev({ kind: "assignee", newValue: "u2" }), ctx)).toBe(
      "김지훈님이 이서연님을 담당자로 정했습니다",
    );
    expect(
      eventSentence(
        ev({ kind: "priority", oldValue: "2", newValue: "3" }),
        ctx,
      ),
    ).toBe("김지훈님이 우선순위를 보통 → 높음으로 바꿨습니다");
  });

  it("체크리스트·관계·시스템 이벤트", () => {
    expect(
      eventSentence(
        ev({ kind: "checklist", field: "로그 확인", newValue: "done" }),
        ctx,
      ),
    ).toBe("김지훈님이 체크리스트 '로그 확인' 항목을 완료로 표시했습니다");
    expect(
      eventSentence(
        ev({ kind: "relation", field: "blocks", newValue: "FD-2" }),
        ctx,
      ),
    ).toBe("김지훈님이 FD-2와 '차단' 관계를 맺었습니다");
    expect(
      eventSentence(
        ev({ kind: "relation", field: "parent", newValue: "FD-3" }),
        ctx,
      ),
    ).toBe("김지훈님이 상위 이슈를 FD-3으로 정했습니다");
    expect(
      eventSentence(ev({ kind: "overdue", newValue: "2026-10-20" }), ctx),
    ).toBe("기한(2026-10-20)이 지났습니다");
    expect(
      eventSentence(
        ev({ kind: "mention", newValue: "u2", commentId: "c1" }),
        ctx,
      ),
    ).toBe("김지훈님이 댓글에서 이서연님을 멘션했습니다");
    expect(eventSentence(ev({ kind: "mention", newValue: "u2" }), ctx)).toBe(
      "김지훈님이 설명에서 이서연님을 멘션했습니다",
    );
  });

  it("상대 시각", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    expect(relativeTime("2026-10-23T11:59:30Z", now)).toBe("방금");
    expect(relativeTime("2026-10-23T11:55:00Z", now)).toBe("5분 전");
    expect(relativeTime("2026-10-23T09:00:00Z", now)).toBe("3시간 전");
    expect(relativeTime("2026-10-21T12:00:00Z", now)).toBe("2일 전");
  });
});
