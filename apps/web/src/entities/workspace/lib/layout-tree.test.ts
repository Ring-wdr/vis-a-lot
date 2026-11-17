import { describe, expect, it } from "vitest";
import {
  applyPreset,
  LAYOUT_PRESET_IDS,
  LAYOUT_PRESETS,
  panelsRemovedByPreset,
  presetLayout,
} from "./layout-presets";
import {
  addPanel,
  type LayoutNode,
  leaf,
  MIN_RATIO,
  moveDivider,
  movePanel,
  nearestEdge,
  nodeAt,
  normalizeLayout,
  panelIdsOf,
  removePanel,
  setSplitRatios,
  split,
} from "./layout-tree";

const row = (...children: LayoutNode[]) => split("horizontal", children);
const column = (...children: LayoutNode[]) => split("vertical", children);
const leaves = (...ids: string[]) => ids.map(leaf);

/** 비율을 소수 오차 안에서 비교한다. */
function expectRatios(node: LayoutNode, expected: number[]) {
  const ratios = node.type === "split" ? node.ratios : [];
  expect(ratios).toHaveLength(expected.length);
  ratios.forEach((r, i) => {
    expect(r).toBeCloseTo(expected[i], 9);
  });
}

/** 비율 합이 1인지 모든 split에서 확인한다. */
function expectNormalized(node: LayoutNode) {
  if (node.type === "leaf") return;
  expect(node.children.length).toBeGreaterThan(1);
  expect(node.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  for (const child of node.children) {
    if (child.type === "split")
      expect(child.direction).not.toBe(node.direction);
    expectNormalized(child);
  }
}

describe("정규화", () => {
  it("자식이 하나인 split은 자식으로 바꾼다", () => {
    expect(normalizeLayout(split("horizontal", [leaf("a")], [1]))).toEqual(
      leaf("a"),
    );
  });

  it("같은 방향으로 겹친 split은 한 단계로 펴고 비율을 곱한다", () => {
    const nested = split(
      "horizontal",
      [leaf("a"), split("horizontal", leaves("b", "c"), [0.25, 0.75])],
      [0.6, 0.4],
    );
    const flat = normalizeLayout(nested);
    expect(panelIdsOf(flat)).toEqual(["a", "b", "c"]);
    expect(flat.type === "split" && flat.direction).toBe("horizontal");
    expectRatios(flat, [0.6, 0.1, 0.3]);
  });

  it("비율 합을 1로 맞춘다", () => {
    const node = normalizeLayout(split("vertical", leaves("a", "b"), [2, 6]));
    expect(node).toEqual(split("vertical", leaves("a", "b"), [0.25, 0.75]));
  });
});

describe("칸 넣기·빼기", () => {
  it("leaf에 더하면 세로로 쌓고, 세로 split이면 끝에 더하고, 가로 split이면 세로로 감싼다", () => {
    const two = addPanel(leaf("a"), "b");
    expect(two).toEqual(column(...leaves("a", "b")));
    const three = addPanel(two, "c");
    expect(panelIdsOf(three)).toEqual(["a", "b", "c"]);
    expectRatios(three, [1 / 3, 1 / 3, 1 / 3]);
    const wrapped = addPanel(row(...leaves("a", "b")), "c");
    expect(wrapped).toEqual(
      split("vertical", [row(...leaves("a", "b")), leaf("c")], [0.5, 0.5]),
    );
  });

  it("새 칸은 1/n을 받고 나머지는 같은 비율로 줄인다", () => {
    const node = addPanel(split("vertical", leaves("a", "b"), [0.8, 0.2]), "c");
    expectRatios(node, [0.8 * (2 / 3), 0.2 * (2 / 3), 1 / 3]);
  });

  it("빼면 형제가 몫을 비율대로 나누고, 자식이 하나 남은 split은 접는다", () => {
    const node = column(row(...leaves("a", "b")), leaf("c"));
    expect(removePanel(node, "c")).toEqual(row(...leaves("a", "b")));
    const three = split("horizontal", leaves("a", "b", "c"), [0.5, 0.3, 0.2]);
    const rest = removePanel(three, "a");
    expect(rest?.type === "split" && rest.ratios[0]).toBeCloseTo(0.6);
    expect(removePanel(leaf("a"), "a")).toBeNull();
    // 없는 칸이면 그대로다.
    expect(removePanel(three, "z")).toEqual(three);
  });
});

describe("칸 옮기기", () => {
  const board = column(row(...leaves("a", "b")), leaf("c"));

  it("같은 방향이면 대상의 형제로 넣고 대상의 몫을 반씩 나눈다", () => {
    const moved = movePanel(board, "c", "b", "right");
    expect(moved).toEqual(
      split("horizontal", leaves("a", "b", "c"), [0.5, 0.25, 0.25]),
    );
    const before = movePanel(board, "c", "a", "left");
    expect(panelIdsOf(before)).toEqual(["c", "a", "b"]);
  });

  it("다른 방향이면 대상을 split으로 감싼다", () => {
    const moved = movePanel(board, "c", "a", "bottom");
    expect(moved).toEqual(row(column(...leaves("a", "c")), leaf("b")));
    const top = movePanel(board, "b", "c", "top");
    expect(top).toEqual(
      split("vertical", [leaf("a"), leaf("b"), leaf("c")], [0.5, 0.25, 0.25]),
    );
  });

  it("두 칸이면 남은 칸을 감싼다", () => {
    expect(movePanel(row(...leaves("a", "b")), "a", "b", "bottom")).toEqual(
      column(...leaves("b", "a")),
    );
  });

  it("자기 자신이나 없는 칸이면 그대로 돌려준다", () => {
    expect(movePanel(board, "a", "a", "left")).toBe(board);
    expect(movePanel(board, "z", "a", "left")).toBe(board);
    expect(movePanel(board, "a", "z", "left")).toBe(board);
  });

  it("옮긴 결과는 늘 정규화돼 있다", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const edges = ["top", "right", "bottom", "left"] as const;
    let node: LayoutNode = presetLayout("2x3", [...ids, "f"]);
    for (const from of ids)
      for (const to of ids)
        for (const edge of edges) {
          node = movePanel(node, from, to, edge);
          expectNormalized(node);
          expect([...panelIdsOf(node)].sort()).toEqual([...ids, "f"]);
        }
  });
});

describe("비율", () => {
  it("경계를 옮기면 두 칸만 바뀌고 최소 몫 아래로 줄지 않는다", () => {
    const moved = moveDivider([0.5, 0.3, 0.2], 1, 0.1);
    expectRatios(
      split("horizontal", leaves("a", "b", "c"), moved),
      [0.5, 0.4, 0.1],
    );
    const clamped = moveDivider([0.5, 0.5], 0, 0.9);
    expect(clamped[1]).toBeCloseTo(MIN_RATIO);
    expect(clamped[0]).toBeCloseTo(1 - MIN_RATIO);
    expect(moveDivider([0.5, 0.5], 0, -0.9)[0]).toBeCloseTo(MIN_RATIO);
  });

  it("경로의 split 비율을 바꾸고, 자리가 틀리면 그대로 둔다", () => {
    const board = column(row(...leaves("a", "b")), leaf("c"));
    const resized = setSplitRatios(board, [0], [0.7, 0.3]);
    expect(nodeAt(resized, [0])).toEqual(
      split("horizontal", leaves("a", "b"), [0.7, 0.3]),
    );
    expect(nodeAt(resized, [1])).toEqual(leaf("c"));
    expect(setSplitRatios(board, [1], [0.5, 0.5])).toBe(board);
    expect(setSplitRatios(board, [0], [1])).toBe(board);
  });
});

describe("놓을 변", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  it("가장 가까운 변을 고른다", () => {
    expect(nearestEdge(rect, { x: 10, y: 50 })).toBe("left");
    expect(nearestEdge(rect, { x: 190, y: 50 })).toBe("right");
    expect(nearestEdge(rect, { x: 100, y: 5 })).toBe("top");
    expect(nearestEdge(rect, { x: 100, y: 95 })).toBe("bottom");
  });
});

describe("preset", () => {
  it("17개이고 칸 수가 모양과 같다", () => {
    expect(LAYOUT_PRESETS).toHaveLength(17);
    const counts = Object.fromEntries(
      LAYOUT_PRESETS.map((p) => [p.id, p.panels]),
    );
    expect(counts).toEqual({
      "1x1": 1,
      "1x2": 2,
      "2x1": 2,
      "1x3": 3,
      "3x1": 3,
      "left-big-2": 3,
      "right-big-2": 3,
      "top-big-2": 3,
      "bottom-big-2": 3,
      "2x2": 4,
      "1x4": 4,
      "4x1": 4,
      "left-big-3": 4,
      "top-big-3": 4,
      "2x3": 6,
      "3x2": 6,
      "3x3": 9,
    });
    for (const id of LAYOUT_PRESET_IDS) {
      const ids = Array.from({ length: counts[id] }, (_, i) => `p${i}`);
      const node = presetLayout(id, ids);
      expect(panelIdsOf(node)).toEqual(ids);
      expectNormalized(node);
    }
  });

  it("R×C는 행×열이다", () => {
    expect(presetLayout("1x2", ["a", "b"])).toEqual(row(...leaves("a", "b")));
    expect(presetLayout("2x1", ["a", "b"])).toEqual(
      column(...leaves("a", "b")),
    );
    expect(presetLayout("left-big-2", ["a", "b", "c"])).toEqual(
      row(leaf("a"), column(...leaves("b", "c"))),
    );
  });

  it("모자라면 빈 칸을 더하고 남으면 뒤 번호부터 지운다", () => {
    const board = column(row(...leaves("a", "b")), leaf("c"));
    let n = 0;
    const grown = applyPreset(board, "2x2", () => `new${n++}`);
    expect(panelIdsOf(grown.layout)).toEqual(["a", "b", "c", "new0"]);
    expect(grown).toMatchObject({ added: ["new0"], removed: [] });
    const shrunk = applyPreset(board, "1x1", () => "x");
    expect(shrunk).toEqual({
      layout: leaf("a"),
      added: [],
      removed: ["b", "c"],
    });
    expect(panelsRemovedByPreset(board, "1x2")).toEqual(["c"]);
  });
});
