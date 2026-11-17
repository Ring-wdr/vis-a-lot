// 레이아웃 preset 17개. 9칸까지에서 자주 쓰는 균등 격자와 '큰 칸 하나 + 작은 칸 여럿' 모양이다.
// 이름의 R×C는 행×열이다 (1×2 = 한 줄에 두 칸).

import {
  type LayoutNode,
  leaf,
  normalizeLayout,
  panelIdsOf,
  type SplitDirection,
  split,
} from "./layout-tree";

/** preset의 모양. 숫자는 칸 자리(0부터, 칸 번호 순)다. */
type Shape = number | { dir: SplitDirection; children: Shape[] };

const row = (...children: Shape[]): Shape => ({ dir: "horizontal", children });
const column = (...children: Shape[]): Shape => ({
  dir: "vertical",
  children,
});
/** 자리 from부터 n개를 한 줄에 */
const cells = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => from + i);
/** rows × cols 균등 격자 */
const grid = (rows: number, cols: number): Shape =>
  rows === 1
    ? row(...cells(0, cols))
    : column(
        ...cells(0, rows).map((r) =>
          cols === 1 ? r : row(...cells(r * cols, cols)),
        ),
      );

export const LAYOUT_PRESET_IDS = [
  "1x1",
  "1x2",
  "2x1",
  "1x3",
  "3x1",
  "left-big-2",
  "right-big-2",
  "top-big-2",
  "bottom-big-2",
  "2x2",
  "1x4",
  "4x1",
  "left-big-3",
  "top-big-3",
  "2x3",
  "3x2",
  "3x3",
] as const;
export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

const SHAPES: Record<LayoutPresetId, Shape> = {
  "1x1": 0,
  "1x2": grid(1, 2),
  "2x1": grid(2, 1),
  "1x3": grid(1, 3),
  "3x1": grid(3, 1),
  // 큰 칸 하나 + 작은 칸 2
  "left-big-2": row(0, column(1, 2)),
  "right-big-2": row(column(0, 1), 2),
  "top-big-2": column(0, row(1, 2)),
  "bottom-big-2": column(row(0, 1), 2),
  "2x2": grid(2, 2),
  "1x4": grid(1, 4),
  "4x1": grid(4, 1),
  // 큰 칸 하나 + 작은 칸 3
  "left-big-3": row(0, column(1, 2, 3)),
  "top-big-3": column(0, row(1, 2, 3)),
  "2x3": grid(2, 3),
  "3x2": grid(3, 2),
  "3x3": grid(3, 3),
};

const countOf = (shape: Shape): number =>
  typeof shape === "number"
    ? 1
    : shape.children.reduce<number>((sum, c) => sum + countOf(c), 0);

export type LayoutPreset = {
  id: LayoutPresetId;
  /** 칸 수 */
  panels: number;
};

/** 화면(레이아웃 popover)에 보이는 순서. 칸 수가 적은 것부터다. 이름은 화면이 id로 정한다. */
export const LAYOUT_PRESETS: readonly LayoutPreset[] = LAYOUT_PRESET_IDS.map(
  (id) => ({ id, panels: countOf(SHAPES[id]) }),
);

/**
 * preset 모양에 칸 id를 자리 순서로 채운 트리. ids는 preset 칸 수만큼 있어야 한다.
 * popover의 작은 그림은 아무 id(자리 번호 등)로 이 트리를 그리면 된다.
 */
export function presetLayout(
  id: LayoutPresetId,
  ids: readonly string[],
): LayoutNode {
  const build = (shape: Shape): LayoutNode =>
    typeof shape === "number"
      ? leaf(ids[shape])
      : split(shape.dir, shape.children.map(build));
  return normalizeLayout(build(SHAPES[id]));
}

export function presetPanelCount(id: LayoutPresetId) {
  return countOf(SHAPES[id]);
}

/** preset을 적용하면 지워질 칸 (뒤 번호부터). 그린 칸이 있으면 화면이 먼저 확인을 받는다. */
export function panelsRemovedByPreset(layout: LayoutNode, id: LayoutPresetId) {
  return panelIdsOf(layout).slice(presetPanelCount(id));
}

/**
 * preset을 적용한다. 지금 칸을 번호 순으로 preset 자리에 채우고, 모자라면 newId()로 빈 칸을 더하고,
 * 남으면 뒤 번호 칸부터 지운다.
 */
export function applyPreset(
  layout: LayoutNode,
  id: LayoutPresetId,
  newId: () => string,
): { layout: LayoutNode; added: string[]; removed: string[] } {
  const current = panelIdsOf(layout);
  const count = presetPanelCount(id);
  const kept = current.slice(0, count);
  const added = Array.from({ length: count - kept.length }, newId);
  return {
    layout: presetLayout(id, [...kept, ...added]),
    added,
    removed: current.slice(count),
  };
}
