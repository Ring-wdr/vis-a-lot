import { describe, expect, it } from "vitest";
import { addDays, localToday, myFilter, myWorkHref, parseTab } from "./my-work";

describe("내 작업 탭·필터", () => {
  it("모르는 탭은 담당", () => {
    expect(parseTab(null)).toBe("assigned");
    expect(parseTab("nope")).toBe("assigned");
    expect(parseTab("review")).toBe("review");
  });

  it("링크", () => {
    expect(myWorkHref({ tab: "review" })).toBe("/feed/my?tab=review");
    expect(myWorkHref({ tab: "assigned", dueSoon: true })).toBe(
      "/feed/my?tab=assigned&due=soon",
    );
    expect(myWorkHref({ tab: "stakeholder", includeClosed: true })).toBe(
      "/feed/my?tab=stakeholder&closed=1",
    );
  });

  it("날짜 더하기는 달을 넘긴다", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(localToday(new Date(2026, 0, 5, 23, 0))).toBe("2026-01-05");
  });

  it("기본은 열림·멈춤, 닫힌 것 포함이면 범주를 풀고, 기한 임박은 열림+기한", () => {
    expect(myFilter("assigned", { includeClosed: false })).toEqual({
      mine: "assigned",
      categories: ["open", "paused"],
    });
    expect(myFilter("review", { includeClosed: true })).toEqual({
      mine: "review",
    });
    expect(
      myFilter("assigned", { includeClosed: true, dueSoonUntil: "2026-10-26" }),
    ).toEqual({ mine: "assigned", categories: ["open"], dueTo: "2026-10-26" });
  });
});
