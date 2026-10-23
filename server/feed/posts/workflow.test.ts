import { describe, expect, it } from "vitest";
import {
  autoProgress,
  categoryOf,
  type PostRoles,
  reachableStatuses,
  transitionKind,
  transitionViaMove,
} from "./workflow";

const none: PostRoles = {
  author: false,
  assignee: false,
  requester: false,
  stakeholder: false,
  admin: false,
  reviewer: false,
};

describe("전이 규칙", () => {
  it("카테고리", () => {
    expect(categoryOf("in_review")).toBe("open");
    expect(categoryOf("on_hold")).toBe("paused");
    expect(categoryOf("cancelled")).toBe("closed");
  });

  it("규칙에 있는 전이만 종류가 있다", () => {
    expect(transitionKind("unresolved", "in_progress")).toBe("start");
    expect(transitionKind("in_progress", "in_review")).toBe("requestReview");
    expect(transitionKind("in_review", "resolved")).toBe("approve");
    expect(transitionKind("in_review", "in_progress")).toBe("reject");
    expect(transitionKind("in_review", "on_hold")).toBe("hold");
    expect(transitionKind("unresolved", "cancelled")).toBe("cancel");
    expect(transitionKind("on_hold", "unresolved")).toBe("resume");
    expect(transitionKind("cancelled", "unresolved")).toBe("reopen");
    expect(transitionKind("unresolved", "resolved")).toBeNull();
    expect(transitionKind("on_hold", "cancelled")).toBeNull();
    expect(transitionKind("resolved", "in_progress")).toBeNull();
  });

  it("반려는 transition으로 못 한다", () => {
    expect(transitionViaMove("in_review", "in_progress")).toBeNull();
  });

  it("역할별로 갈 수 있는 상태", () => {
    expect(reachableStatuses("unresolved", none)).toEqual([]);
    expect(
      reachableStatuses("unresolved", { ...none, assignee: true }),
    ).toEqual(["in_progress", "on_hold", "cancelled"]);
    expect(reachableStatuses("unresolved", { ...none, author: true })).toEqual([
      "on_hold",
      "cancelled",
    ]);
    expect(reachableStatuses("in_review", { ...none, reviewer: true })).toEqual(
      ["resolved"],
    );
    expect(reachableStatuses("resolved", { ...none, assignee: true })).toEqual(
      [],
    );
    expect(reachableStatuses("resolved", { ...none, admin: true })).toEqual([
      "unresolved",
    ]);
  });

  it("진행률: 하위 우선, 그다음 체크리스트, 없으면 수동", () => {
    expect(autoProgress({ total: 3, done: 1 }, { total: 2, done: 2 })).toBe(33);
    expect(autoProgress({ total: 0, done: 0 }, { total: 4, done: 3 })).toBe(75);
    expect(
      autoProgress({ total: 0, done: 0 }, { total: 0, done: 0 }),
    ).toBeNull();
  });
});
