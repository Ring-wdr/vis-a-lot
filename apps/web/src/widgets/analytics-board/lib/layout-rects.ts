// 레이아웃 트리를 보드 위의 자리(보드 크기에 대한 몫, 0~1)로 푼다.
// 칸은 트리 모양과 상관없이 한 목록으로 그리고 이 자리에 놓는다. 그래야 옮기거나 칸을 더해 트리 모양이 바뀌어도
// 칸 내용(차트)을 다시 마운트하지 않는다. 경계 손잡이도 같은 목록에서 이 자리에 놓는다.

import type {
  LayoutNode,
  NodePath,
  SplitDirection,
} from "@/entities/workspace/lib/layout-tree";

/** 보드 안의 자리. 모두 보드 폭·높이에 대한 몫이다. */
export type Box = { left: number; top: number; width: number; height: number };

/** split 안 이웃 둘 사이의 경계 (크기 조절 손잡이 하나) */
export type Divider = {
  /** 경로와 순번으로 만든 key. 비율만 바뀌면 그대로다. */
  key: string;
  /** 경계가 속한 split의 경로 */
  path: NodePath;
  /** ratios[index]와 ratios[index + 1] 사이 경계 */
  index: number;
  direction: SplitDirection;
  ratios: readonly number[];
  /** split 전체의 자리 */
  box: Box;
  /** 경계의 자리: horizontal이면 보드 왼쪽에서, vertical이면 위에서의 몫 */
  at: number;
};

export type BoardRects = {
  cells: ReadonlyMap<string, Box>;
  dividers: readonly Divider[];
};

export const FULL_BOX: Box = { left: 0, top: 0, width: 1, height: 1 };

/** 트리의 칸 자리와 경계를 구한다. */
export function boardRects(layout: LayoutNode): BoardRects {
  const cells = new Map<string, Box>();
  const dividers: Divider[] = [];
  const walk = (node: LayoutNode, box: Box, path: number[]) => {
    if (node.type === "leaf") {
      cells.set(node.panelId, box);
      return;
    }
    const row = node.direction === "horizontal";
    const length = row ? box.width : box.height;
    let offset = row ? box.left : box.top;
    node.children.forEach((child, i) => {
      const size = length * node.ratios[i];
      const childBox = row
        ? { ...box, left: offset, width: size }
        : { ...box, top: offset, height: size };
      walk(child, childBox, [...path, i]);
      offset += size;
      if (i < node.children.length - 1)
        dividers.push({
          key: `${path.join(".")}/${i}`,
          path,
          index: i,
          direction: node.direction,
          ratios: node.ratios,
          box,
          at: offset,
        });
    });
  };
  walk(layout, FULL_BOX, []);
  return { cells, dividers };
}

const pct = (v: number) => `${+(v * 100).toFixed(4)}%`;

/** 칸 자리의 인라인 스타일 (런타임 값) */
export function boxStyle(box: Box) {
  return {
    left: pct(box.left),
    top: pct(box.top),
    width: pct(box.width),
    height: pct(box.height),
  };
}

/** 경계 손잡이의 인라인 스타일. 손잡이 폭(두께)은 클래스로 정하고 경계 선에 가운데를 맞춘다. */
export function dividerStyle(d: Divider) {
  return d.direction === "horizontal"
    ? { left: pct(d.at), top: pct(d.box.top), height: pct(d.box.height) }
    : { top: pct(d.at), left: pct(d.box.left), width: pct(d.box.width) };
}
