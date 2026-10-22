import { describe, expect, it } from "vitest";
import type { CategoryData } from "./category-data";
import { OTHERS_SLICE, toPieData } from "./polar-data";

/** split 조합마다 [범주, 값] 목록. legend 없는 bar 집계 모양으로 만든다. */
const bars = (groups: [string, number | null][][]): CategoryData => ({
  groups: groups.map((cells, i) => ({
    values: [`g${i}`],
    categories: cells.map(([c]) => c),
    bars: cells.map(([, v]) => [v]),
  })),
});

describe("toPieData", () => {
  it("큰 순으로 놓고 0 이하·빈 값은 뺀다", () => {
    const data = toPieData(
      bars([
        [
          ["a", 1],
          ["b", 5],
          ["c", -2],
          ["d", null],
          ["e", 0],
        ],
      ]),
    );
    expect(data.groups[0].slices).toEqual([
      { category: "b", value: 5 },
      { category: "a", value: 1 },
    ]);
    expect(data.colorOrder).toEqual(["b", "a"]);
  });

  it("item 안에서 상위 범주만 이름을 붙이고 나머지는 '기타'로 끝에 더한다", () => {
    const data = toPieData(
      bars([
        [
          ["a", 10],
          ["b", 1],
          ["c", 2],
        ],
        [
          ["b", 30],
          ["c", 1],
        ],
      ]),
      2,
    );
    expect(data.groups[0].slices).toEqual([
      { category: "a", value: 10 },
      { category: "c", value: 2 },
      { category: OTHERS_SLICE, value: 1 },
    ]);
    expect(data.groups[1].slices).toEqual([
      { category: "b", value: 30 },
      { category: "c", value: 1 },
    ]);
    // 이름 붙은 범주가 a, b, c로 top(2)보다 많아 색은 item 안 순서로 준다.
    expect(data.colorOrder).toBeNull();
  });

  it("이름 붙은 범주가 팔레트에 들어가면 전체 합계 순서로 색을 맞춘다", () => {
    const data = toPieData(
      bars([
        [
          ["a", 1],
          ["b", 2],
        ],
        [["a", 5]],
      ]),
    );
    expect(data.colorOrder).toEqual(["a", "b"]);
  });
});
