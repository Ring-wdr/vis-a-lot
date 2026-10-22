import { describe, expect, it } from "vitest";
import { legendColumnOf } from "../charts/chart-fields";
import { stepPoint, waterfallSteps } from "./waterfall";

describe("waterfallSteps", () => {
  it("이전 누적에서 시작해 값만큼 오르내리고, 마지막에 합계 막대를 둔다", () => {
    expect(waterfallSteps([10, -4, null, 6])).toEqual([
      { start: 0, end: 10, kind: 0 },
      { start: 10, end: 6, kind: 1 },
      // 데이터가 없는 범주는 0으로 보고 증가로 둔다
      { start: 6, end: 6, kind: 0 },
      { start: 6, end: 12, kind: 0 },
      { start: 0, end: 12, kind: 2 },
    ]);
  });

  it("대표 좌표는 막대 인덱스와 끝 값", () => {
    expect(stepPoint(1, { start: 10, end: 6, kind: 1 })).toEqual([1, 6]);
  });

  it("legend를 스스로 만드는 차트는 spec에 남은 legend 컬럼을 쓰지 않는다", () => {
    expect(legendColumnOf({ chartType: "waterfall", legend: "kind" })).toBe(
      null,
    );
    expect(legendColumnOf({ chartType: "bar", legend: "kind" })).toBe("kind");
  });
});
