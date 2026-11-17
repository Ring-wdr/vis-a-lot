import { describe, expect, it } from "vitest";
import { moveInOrder, naturalCompare, orderedList } from "./order-list";

describe("orderedList", () => {
  it("저장한 값을 앞에, 나머지를 정렬 순으로. 없는 값은 건너뛴다", () => {
    expect(
      orderedList(["L2", "L10", "L1"], ["없음", "L10"], "natural"),
    ).toEqual({ list: ["L10", "L1", "L2"], pinned: 1 });
    expect(orderedList(["b", "a"], [], "default")).toEqual({
      list: ["b", "a"],
      pinned: 0,
    });
  });

  it("자연 정렬은 서버와 같은 규칙이다", () => {
    expect(["A12", "A3", "A1"].sort(naturalCompare)).toEqual([
      "A1",
      "A3",
      "A12",
    ]);
  });
});

describe("moveInOrder", () => {
  const list = ["c", "a", "b", "d"];

  it("저장하지 않은 값을 옮기면 맨 위부터 그 값까지가 순서다", () => {
    expect(moveInOrder(list, 0, 3, 1)).toEqual(["c", "d"]);
    expect(moveInOrder(list, 0, 0, 2)).toEqual(["a", "b", "c"]);
  });

  it("앞서 옮긴 값은 지킨다", () => {
    // c, a를 저장해 둔 상태에서 d를 맨 위로
    expect(moveInOrder(list, 2, 3, 0)).toEqual(["d", "c", "a"]);
    // 저장한 값끼리 바꾸면 길이는 그대로
    expect(moveInOrder(list, 2, 1, 0)).toEqual(["a", "c"]);
    // 저장한 값을 아래로 빼면 그 자리까지
    expect(moveInOrder(list, 2, 0, 3)).toEqual(["a", "b", "d", "c"]);
  });

  it("제자리면 저장한 순서 그대로", () => {
    expect(moveInOrder(list, 2, 1, 1)).toEqual(["c", "a"]);
  });
});
