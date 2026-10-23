import { describe, expect, it } from "vitest";
import type { PostSummary } from "@/shared/api/feed/types";
import {
  byStatus,
  groupPosts,
  isOverdue,
  planMove,
  teamLanes,
} from "./post-model";

const post = (over: Partial<PostSummary>): PostSummary => ({
  id: "p",
  key: "FD-1",
  groupId: "g",
  teamId: null,
  postTypeId: null,
  format: "image",
  title: "t",
  status: "unresolved",
  category: "open",
  priority: 2,
  progress: 0,
  authorId: "u1",
  assigneeId: null,
  requesterId: null,
  stakeholderIds: [],
  parentId: null,
  dueDate: null,
  holdUntil: null,
  closeReason: null,
  tags: [],
  thumbnail: null,
  pinnedAt: null as never,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  resolvedAt: null as never,
  commentCount: 0,
  childCount: 0,
  childResolvedCount: 0,
  blocked: false,
  ...over,
});

const USERS: Record<string, string> = { u1: "김지훈", u2: "가나다" };
const names = {
  status: (s: string) => s,
  user: (id: string) => USERS[id] ?? id,
  priority: (p: number) => `P${p}`,
};

describe("groupPosts", () => {
  const posts = [
    post({ id: "a", status: "resolved", priority: 1, assigneeId: "u1" }),
    post({ id: "b", status: "unresolved", priority: 4 }),
    post({ id: "c", status: "in_review", priority: 1, assigneeId: "u2" }),
    post({ id: "d", status: "unresolved", priority: 2, assigneeId: "u1" }),
  ];

  it("상태는 보드 순서, 그룹 안은 들어온 순서", () => {
    const g = groupPosts(posts, "status", names);
    expect(g.map((x) => x.id)).toEqual(["unresolved", "in_review", "resolved"]);
    expect(g[0].posts.map((p) => p.id)).toEqual(["b", "d"]);
  });

  it("우선순위는 높은 것부터", () => {
    const g = groupPosts(posts, "priority", names);
    expect(g.map((x) => x.label)).toEqual(["P4", "P2", "P1"]);
    expect(g[2].posts).toHaveLength(2);
  });

  it("담당자는 이름순, 담당자 없음은 끝", () => {
    const g = groupPosts(posts, "assignee", names);
    expect(g.map((x) => x.label)).toEqual(["가나다", "김지훈", "담당자 없음"]);
  });
});

describe("isOverdue", () => {
  const today = "2026-10-23";
  it("열린 게시물의 지난 기한만", () => {
    expect(isOverdue({ dueDate: "2026-10-22", category: "open" }, today)).toBe(
      true,
    );
    expect(isOverdue({ dueDate: "2026-10-23", category: "open" }, today)).toBe(
      false,
    );
    expect(
      isOverdue({ dueDate: "2026-10-01", category: "closed" }, today),
    ).toBe(false);
    expect(isOverdue({ dueDate: null, category: "open" }, today)).toBe(false);
  });
});

describe("teamLanes", () => {
  const teams = [
    { id: "t1", name: "데이터" },
    { id: "t2", name: "디자인" },
  ];
  it("팀 순서대로, 팀 없음은 있을 때만 끝에", () => {
    const lanes = teamLanes(
      [
        post({ id: "a", teamId: "t2" }),
        post({ id: "b" }),
        post({ id: "c", teamId: "gone" }),
      ],
      teams,
    );
    expect(lanes.map((l) => [l.label, l.posts.length])).toEqual([
      ["데이터", 0],
      ["디자인", 1],
      ["팀 없음", 2],
    ]);
    expect(teamLanes([post({ teamId: "t1" })], teams)).toHaveLength(2);
  });
});

describe("byStatus", () => {
  it("상태 6개를 모두 만든다", () => {
    const s = byStatus([post({ status: "on_hold" })]);
    expect(Object.keys(s)).toHaveLength(6);
    expect(s.on_hold).toHaveLength(1);
  });
});

describe("planMove", () => {
  it("열에 따라 API를 고른다", () => {
    expect(planMove("unresolved", "unresolved")).toBeNull();
    expect(planMove("in_progress", "in_review")).toBe("requestReview");
    expect(planMove("in_review", "resolved")).toBe("approve");
    expect(planMove("in_review", "in_progress")).toBe("reject");
    expect(planMove("in_review", "on_hold")).toBe("hold");
    expect(planMove("unresolved", "cancelled")).toBe("cancel");
    expect(planMove("resolved", "unresolved")).toBe("reopen");
    expect(planMove("cancelled", "unresolved")).toBe("reopen");
    expect(planMove("on_hold", "unresolved")).toBe("transition");
    expect(planMove("unresolved", "in_progress")).toBe("transition");
    expect(planMove("in_progress", "resolved")).toBe("transition");
  });
});
