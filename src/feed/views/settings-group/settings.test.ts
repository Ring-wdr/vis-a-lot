import { describe, expect, it } from "vitest";
import type { GroupDetail, PostType } from "../../api/types";
import { basicPatch, KEY_PREFIX_PATTERN } from "./BasicSection";
import { reorder } from "./PostTypesSection";
import { toStatusNames } from "./StatusNamesSection";

const group: GroupDetail = {
  id: "g1",
  name: "피드",
  keyPrefix: "FD",
  description: null,
  isPrivate: false,
  statusNames: {},
  myRole: "admin",
  memberCount: 1,
  members: [],
  teams: [],
  postTypes: [],
};

describe("group settings", () => {
  it("기본 정보는 바뀐 칸만 보낸다", () => {
    expect(
      basicPatch(group, {
        name: " 피드 ",
        description: "",
        isPrivate: false,
        keyPrefix: "FD",
      }),
    ).toEqual({});
    expect(
      basicPatch(group, {
        name: "피드2",
        description: "설명",
        isPrivate: true,
        keyPrefix: "FE",
      }),
    ).toEqual({
      name: "피드2",
      description: "설명",
      isPrivate: true,
      keyPrefix: "FE",
    });
    expect(KEY_PREFIX_PATTERN.test("F")).toBe(false);
    expect(KEY_PREFIX_PATTERN.test("FD2")).toBe(true);
    expect(KEY_PREFIX_PATTERN.test("2FD")).toBe(false);
  });

  it("상태 이름: 비었거나 기본 이름과 같으면 뺀다", () => {
    expect(
      toStatusNames({
        unresolved: "",
        in_progress: "진행 중",
        in_review: " 승인 대기 ",
        resolved: "",
        on_hold: "",
        cancelled: "",
      }),
    ).toEqual({ in_review: "승인 대기" });
  });

  it("유형 순서를 바꾸면 sort가 달라진 것만", () => {
    const types: PostType[] = ["가", "나", "다"].map((name, i) => ({
      id: name,
      name,
      color: null,
      sort: i,
    }));
    expect(reorder(types, 2, 1).map((t) => [t.id, t.sort])).toEqual([
      ["다", 1],
      ["나", 2],
    ]);
  });
});
