import { describe, expect, it } from "vitest";
import { DEFAULT_COLUMNS } from "@/entities/post/model/post-model";
import {
  countFilters,
  DEFAULT_SORT,
  decodeListState,
  encodeListState,
  type ListState,
} from "./filter-url";

const q = (s = "") => new URLSearchParams(s);

describe("decodeListState", () => {
  it("빈 query는 기본값이다", () => {
    expect(decodeListState(q("g=FD"))).toEqual({
      filter: {},
      sort: DEFAULT_SORT,
      groupBy: null,
      columns: DEFAULT_COLUMNS,
    });
  });

  it("모르는 값과 잘못된 날짜는 버린다", () => {
    const s = decodeListState(
      q(
        "status=unresolved,nope,unresolved&priority=4,9,x&format=chart,gif&due_from=2026-10-01&due_to=10/31&group=team&sort=title.up&cols=title,zzz,key",
      ),
    );
    expect(s.filter).toEqual({
      statuses: ["unresolved"],
      priorities: [4],
      formats: ["chart"],
      dueFrom: "2026-10-01",
    });
    expect(s.groupBy).toBeNull();
    expect(s.sort).toEqual(DEFAULT_SORT);
    // 열은 표 순서로 맞춘다
    expect(s.columns).toEqual(["key", "title"]);
  });
});

describe("encodeListState", () => {
  it("다른 query는 두고 기본값은 적지 않는다", () => {
    const next = encodeListState(
      {
        filter: {},
        sort: DEFAULT_SORT,
        groupBy: null,
        columns: DEFAULT_COLUMNS,
      },
      q("g=FD&peek=FD-1&status=resolved"),
    );
    expect(next.toString()).toBe("g=FD&peek=FD-1");
  });

  it("encode → decode가 같은 상태로 돌아온다", () => {
    const state: ListState = {
      filter: {
        statuses: ["in_progress", "in_review"],
        categories: ["open"],
        priorities: [3, 4],
        assigneeIds: ["u1", "u2"],
        requesterIds: ["u3"],
        postTypeIds: ["pt1"],
        teamIds: ["t1"],
        formats: ["image"],
        tags: ["데이터"],
        dueFrom: "2026-10-01",
        dueTo: "2026-10-31",
        overdue: true,
        q: "매출",
      },
      sort: { field: "dueDate", dir: "asc" },
      groupBy: "assignee",
      columns: ["key", "title", "thumbnail"],
    };
    const encoded = encodeListState(state, q("g=FD"));
    expect(encoded.get("g")).toBe("FD");
    expect(encoded.get("sort")).toBe("dueDate.asc");
    expect(decodeListState(encoded)).toEqual(state);
  });

  it("검색어 앞뒤 공백을 지운다", () => {
    expect(encodeListState({ filter: { q: "  " } }).has("q")).toBe(false);
    expect(encodeListState({ filter: { q: " a " } }).get("q")).toBe("a");
  });
});

describe("countFilters", () => {
  it("조건 종류 수를 센다 (기한 범위는 하나)", () => {
    expect(countFilters({})).toBe(0);
    expect(
      countFilters({
        statuses: ["resolved"],
        dueFrom: "2026-01-01",
        dueTo: "2026-02-01",
        overdue: true,
        q: "x",
        groupIds: ["g"],
      }),
    ).toBe(3);
  });
});
