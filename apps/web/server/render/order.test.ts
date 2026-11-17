import { describe, expect, it } from "vitest";
import {
  isIdentityOrder,
  naturalCompare,
  orderIndexes,
  orderValues,
} from "./order";

describe("naturalCompare", () => {
  it("글자 안 숫자를 수로 견준다", () => {
    expect(["A12", "A3", "A1"].sort(naturalCompare)).toEqual([
      "A1",
      "A3",
      "A12",
    ]);
    expect(["L10", "L2", "L1"].sort(naturalCompare)).toEqual([
      "L1",
      "L2",
      "L10",
    ]);
  });

  it("숫자가 여러 덩어리여도, 아주 큰 수여도 수로 견준다", () => {
    expect(
      [
        "v1.10",
        "v1.2",
        "v1.9",
        "x99999999999999999999",
        "x100000000000000000000",
      ].sort(naturalCompare),
    ).toEqual([
      "v1.2",
      "v1.9",
      "v1.10",
      "x99999999999999999999",
      "x100000000000000000000",
    ]);
  });

  it("수가 같으면 표기 순, 짧은 쪽이 앞이다", () => {
    expect(naturalCompare("A01", "A1")).toBeLessThan(0);
    expect(naturalCompare("A", "A1")).toBeLessThan(0);
    expect(naturalCompare("a", "a")).toBe(0);
  });
});

describe("orderIndexes", () => {
  const values = ["정상", "이상", "경고", "점검"];

  it("기본값(default, 빈 목록)이면 받은 순서 그대로", () => {
    expect(orderIndexes(values, [], "default")).toEqual([0, 1, 2, 3]);
    expect(isIdentityOrder(orderIndexes(values, [], "default"))).toBe(true);
  });

  it("직접 정한 값을 앞에 두고, 나머지는 받은 순서로 뒤에 둔다", () => {
    expect(orderValues(values, ["정상", "경고", "이상"], "default")).toEqual([
      "정상",
      "경고",
      "이상",
      "점검",
    ]);
    expect(orderValues(values, ["점검"], "default")).toEqual([
      "점검",
      "정상",
      "이상",
      "경고",
    ]);
  });

  it("목록에 있지만 values에 없는 값과 겹친 값은 건너뛴다", () => {
    expect(
      orderValues(values, ["없음", "경고", "경고", "정상"], "default"),
    ).toEqual(["경고", "정상", "이상", "점검"]);
  });

  it("natural이면 나머지를 자연 정렬한다", () => {
    const lines = ["L2", "L10", "L1", "L3"];
    expect(orderValues(lines, [], "natural")).toEqual([
      "L1",
      "L2",
      "L3",
      "L10",
    ]);
    expect(orderValues(lines, ["L10"], "natural")).toEqual([
      "L10",
      "L1",
      "L2",
      "L3",
    ]);
    expect(orderIndexes(lines, ["L10"], "natural")).toEqual([1, 2, 0, 3]);
  });
});
