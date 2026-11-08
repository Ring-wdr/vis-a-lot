import { describe, expect, it } from "vitest";
import { groupLinks, SANKEY_OTHERS, topNodes } from "./sankey-data";

describe("topNodes", () => {
  it("상한 이하면 그대로, 넘으면 상한 - 1개 + 기타", () => {
    expect(topNodes(["a", "b"], 3)).toEqual({
      keep: ["a", "b"],
      nodes: ["a", "b"],
    });
    expect(topNodes(["a", "b", "c", "d"], 3)).toEqual({
      keep: ["a", "b"],
      nodes: ["a", "b", SANKEY_OTHERS],
    });
  });
});

describe("groupLinks", () => {
  const sources = ["A", "B", SANKEY_OTHERS];
  const targets = ["x", "y"];

  it("split 조합 단위로 묶고 노드 이름을 인덱스로 바꾼다", () => {
    const rows = [
      ["L1", "A", "x", 3],
      ["L1", SANKEY_OTHERS, "y", 2],
      ["L2", "B", "x", 5],
    ];
    expect(groupLinks(rows, 1, sources, targets)).toEqual([
      {
        values: ["L1"],
        links: [
          { source: 0, target: 0, value: 3 },
          { source: 2, target: 1, value: 2 },
        ],
      },
      { values: ["L2"], links: [{ source: 1, target: 0, value: 5 }] },
    ]);
  });

  it("0 이하·숫자가 아닌 값은 굵기로 그릴 수 없어 뺀다", () => {
    const rows = [
      ["A", "x", 0],
      ["A", "y", -1],
      ["B", "x", null],
      ["B", "y", 4],
    ];
    expect(groupLinks(rows, 0, sources, targets)).toEqual([
      { values: [], links: [{ source: 1, target: 1, value: 4 }] },
    ]);
  });
});
