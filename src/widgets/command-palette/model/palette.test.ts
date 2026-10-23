import { describe, expect, it } from "vitest";
import type { Group } from "@/shared/api/feed/types";
import { matchScore, toChoseong } from "@/widgets/command-palette/lib/match";
import { commandItems, looksLikeKey, rankItems, screenItems } from "./items";
import { pushRecent } from "./recent";

const group = (keyPrefix: string, name: string, admin = false): Group => ({
  id: `g_${keyPrefix}`,
  name,
  keyPrefix,
  description: null,
  isPrivate: false,
  statusNames: {},
  myRole: admin ? "admin" : "member",
  memberCount: 3,
});

describe("matchScore", () => {
  it("앞에서 맞을수록 점수가 작다", () => {
    expect(matchScore("보드", "보드")).toBe(0);
    expect(matchScore("보드", "피드 보드")).toBe(1);
    expect(matchScore("드", "보드")).toBe(2);
    expect(matchScore("없음", "보드")).toBeNull();
    expect(matchScore("", "아무거나")).toBe(0);
  });

  it("낱말이 모두 들어 있어야 하고, 키워드로도 맞는다", () => {
    expect(matchScore("fd 보드", "피드 보드", ["FD"])).not.toBeNull();
    expect(matchScore("dx 보드", "피드 보드", ["FD"])).toBeNull();
    expect(matchScore("활동보고", "피드 활동 보고")).not.toBeNull();
  });

  it("초성으로 맞춘다", () => {
    expect(toChoseong("관리 콘솔")).toBe("ㄱㄹ ㅋㅅ");
    expect(matchScore("ㄱㄹㅋㅅ", "관리 콘솔")).toBe(3);
    expect(matchScore("ㅂㄷ", "피드 보드")).toBe(3);
    expect(matchScore("ㅎㄱ", "피드 보드")).toBeNull();
  });
});

describe("palette items", () => {
  const groups = [group("FD", "피드", true), group("DX", "데이터")];

  it("그룹마다 리스트·보드·보고, 관리자인 그룹만 설정, 관리 콘솔은 시스템 관리자만", () => {
    const ids = screenItems({ groups, isAdmin: false }).map((i) => i.id);
    expect(ids).toContain("screen:board:FD");
    expect(ids).toContain("screen:status:DX");
    expect(ids).toContain("screen:settings:FD");
    expect(ids).not.toContain("screen:settings:DX");
    expect(ids).not.toContain("screen:admin");
    expect(screenItems({ groups, isAdmin: true }).map((i) => i.id)).toContain(
      "screen:admin",
    );
  });

  it("발표 모드는 보고 화면에서만", () => {
    const ids = (reportPage: boolean) =>
      commandItems({ groupKey: "FD", reportPage, presenting: false }).map(
        (i) => i.id,
      );
    expect(ids(false)).not.toContain("cmd:present");
    expect(ids(true)).toContain("cmd:present");
    expect(
      commandItems({ groupKey: null, reportPage: true, presenting: true }).at(
        -1,
      )?.label,
    ).toBe("발표 모드 끄기");
  });

  it("빈 검색어는 최근 고른 것을 앞에, 검색어가 있으면 점수 → 최근 순", () => {
    const items = [
      ...screenItems({ groups, isAdmin: false }),
      ...commandItems({ groupKey: null, reportPage: false, presenting: false }),
    ];
    let recent = pushRecent([], { id: "screen:board:DX" });
    recent = pushRecent(recent, { id: "post:FD-3", label: "글" });
    const empty = rankItems("", items, recent);
    expect(empty.recent.map((i) => i.id)).toEqual([
      "post:FD-3",
      "screen:board:DX",
    ]);
    expect(empty.rest.some((i) => i.id === "screen:board:DX")).toBe(false);

    const boards = rankItems("보드", items, recent).rest.map((i) => i.id);
    expect(boards).toEqual(["screen:board:DX", "screen:board:FD"]);
  });

  it("이슈 키처럼 보이는 검색어", () => {
    const prefixes = ["FD", "DX"];
    expect(looksLikeKey("FD-1", prefixes)).toBe(true);
    expect(looksLikeKey("fd", prefixes)).toBe(true);
    expect(looksLikeKey("12", prefixes)).toBe(true);
    expect(looksLikeKey("board", prefixes)).toBe(false);
    expect(looksLikeKey("보드", prefixes)).toBe(false);
  });
});
