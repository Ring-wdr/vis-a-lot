import { describe, expect, it } from "vitest";
import {
  paramsFromTemplate,
  parseActivityParams,
  writeActivityParams,
} from "./activity-state";
import { dayHeading, presetRange, spanDays } from "./period";

// 2026-10-23은 금요일
const TODAY = "2026-10-23";

describe("기간 프리셋", () => {
  it("이번 주·지난주는 월요일 시작, 최근 7일, 이번 달", () => {
    expect(presetRange("this-week", TODAY)).toEqual({
      from: "2026-10-19",
      to: TODAY,
    });
    expect(presetRange("last-week", TODAY)).toEqual({
      from: "2026-10-12",
      to: "2026-10-18",
    });
    expect(presetRange("7d", TODAY)).toEqual({ from: "2026-10-17", to: TODAY });
    expect(presetRange("month", TODAY)).toEqual({
      from: "2026-10-01",
      to: TODAY,
    });
    // 일요일은 그 주의 끝
    expect(presetRange("this-week", "2026-10-25").from).toBe("2026-10-19");
    expect(presetRange("last-week", "2026-11-02")).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  it("날짜 수와 요일 머리", () => {
    expect(spanDays("2026-10-17", TODAY)).toBe(7);
    expect(spanDays("2026-03-01", "2026-03-31")).toBe(31);
    expect(dayHeading("2026-10-22")).toBe("10월 22일 (목)");
  });
});

describe("활동 보고 URL 조건", () => {
  it("프리셋은 오늘 기준으로 다시 계산하고, 직접 선택만 날짜를 적는다", () => {
    const p = parseActivityParams(
      new URLSearchParams("g=FD&range=last-week&team=t1&types=a,b"),
      TODAY,
    );
    expect(p).toEqual({
      preset: "last-week",
      from: "2026-10-12",
      to: "2026-10-18",
      teamId: "t1",
      assigneeId: undefined,
      postTypeIds: ["a", "b"],
      templateId: undefined,
    });
    const q = writeActivityParams(new URLSearchParams("g=FD&present=1"), {
      ...p,
      preset: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
      postTypeIds: [],
    });
    expect(q.toString()).toBe(
      "g=FD&present=1&range=custom&from=2026-09-01&to=2026-09-30&team=t1",
    );
    expect(parseActivityParams(q, TODAY)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    // 틀린 날짜는 버린다
    expect(
      parseActivityParams(
        new URLSearchParams("range=custom&from=2026-02-30"),
        TODAY,
      ).from,
    ).toBe(TODAY);
  });

  it("템플릿: 7일은 최근 7일, 그 밖은 오늘을 끝으로 하는 직접 선택", () => {
    const base = {
      id: "rt",
      ownerId: "u1",
      groupId: "g",
      name: "주간",
      kind: "activity" as const,
      editable: true,
    };
    expect(
      paramsFromTemplate(
        { ...base, params: { rangeDays: 7, postTypeIds: ["pt"] } },
        TODAY,
      ),
    ).toMatchObject({
      preset: "7d",
      from: "2026-10-17",
      to: TODAY,
      postTypeIds: ["pt"],
      templateId: "rt",
    });
    expect(
      paramsFromTemplate({ ...base, params: { rangeDays: 30 } }, TODAY),
    ).toMatchObject({ preset: "custom", from: "2026-09-24", to: TODAY });
    expect(paramsFromTemplate({ ...base, params: {} }, TODAY)).toMatchObject({
      preset: "this-week",
      from: "2026-10-19",
    });
  });
});
