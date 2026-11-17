// analytics 보드의 칸 배치 트리. 모두 순수 함수이고 새 트리를 돌려준다 (받은 트리는 고치지 않는다).
// 바꾸는 함수는 결과를 늘 정규화한다: 자식이 하나인 split은 그 자식으로 바꾸고, 같은 방향으로 겹친 split은
// 한 단계로 펴고(비율은 곱한다), 비율의 합을 1로 맞춘다.

import type { AnalyticsLayoutNode } from "@/shared/api/types";

/**
 * 칸 배치 트리 (저장 모양 그대로).
 * - leaf: 칸 하나. panelId는 보드 store의 칸 id다.
 * - split: 자식을 나란히 놓는다. horizontal은 왼쪽 → 오른쪽(flex-direction: row), vertical은 위 → 아래(column).
 *   ratios[i]는 children[i]의 몫이고 합은 1이다. 화면은 자식에 `flex: <ratio> 0 0`을 준다.
 */
export type LayoutNode = AnalyticsLayoutNode;
export type LayoutLeaf = Extract<LayoutNode, { type: "leaf" }>;
export type LayoutSplit = Extract<LayoutNode, { type: "split" }>;
export type SplitDirection = LayoutSplit["direction"];
/** 칸을 끌어 놓을 대상 칸의 변 */
export type DropEdge = "top" | "right" | "bottom" | "left";
/** 뿌리에서 자식 순번을 따라 내려간 자리. []는 뿌리다. 크기 조절이 split을 가리킬 때 쓴다. */
export type NodePath = readonly number[];

/** 보드 한 장의 칸 수 한도 */
export const MAX_PANELS = 9;
/** 크기 조절로 줄일 수 있는 칸 한 개의 최소 몫 (그 split 안에서) */
export const MIN_RATIO = 0.05;
/** 크기 조절 손잡이를 화살표 키 한 번에 옮기는 몫 */
export const RATIO_STEP = 0.02;

export const leaf = (panelId: string): LayoutLeaf => ({
  type: "leaf",
  panelId,
});

/** split을 만든다. 비율이 없으면 똑같이 나눈다. 정규화하지 않는다. */
export function split(
  direction: SplitDirection,
  children: LayoutNode[],
  ratios: number[] = children.map(() => 1 / children.length),
): LayoutSplit {
  return { type: "split", direction, children, ratios };
}

/** 칸 id를 깊이 우선 순서로. 이 순서(1부터)가 화면의 칸 번호다. */
export function panelIdsOf(node: LayoutNode): string[] {
  return node.type === "leaf"
    ? [node.panelId]
    : node.children.flatMap(panelIdsOf);
}

export function hasPanel(node: LayoutNode, panelId: string): boolean {
  return node.type === "leaf"
    ? node.panelId === panelId
    : node.children.some((child) => hasPanel(child, panelId));
}

/** 경로의 노드. 없으면 undefined */
export function nodeAt(
  node: LayoutNode,
  path: NodePath,
): LayoutNode | undefined {
  let current: LayoutNode | undefined = node;
  for (const index of path) {
    if (current?.type !== "split") return undefined;
    current = current.children[index];
  }
  return current;
}

/** 합이 1이 되게 나눈다. 0 이하나 숫자가 아닌 값은 똑같이 나눈 몫으로 본다. */
function scaleToOne(ratios: readonly number[]) {
  const fair = 1 / ratios.length;
  const valid = ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : fair));
  const sum = valid.reduce((a, b) => a + b, 0);
  return valid.map((r) => r / sum);
}

/** 정규화. 칸이 하나도 없으면 null */
function clean(node: LayoutNode | null): LayoutNode | null {
  if (!node || node.type === "leaf") return node;
  const children: LayoutNode[] = [];
  const ratios: number[] = [];
  node.children.forEach((child, i) => {
    const kept = clean(child);
    if (!kept) return;
    const ratio = node.ratios[i] ?? 0;
    // 같은 방향으로 겹친 split은 펴서 손자를 자식으로 올린다. 손자의 몫은 자식의 몫에 곱한다.
    if (kept.type === "split" && kept.direction === node.direction) {
      const inner = scaleToOne(kept.ratios);
      kept.children.forEach((grandchild, j) => {
        children.push(grandchild);
        ratios.push(ratio * inner[j]);
      });
    } else {
      children.push(kept);
      ratios.push(ratio);
    }
  });
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return split(node.direction, children, scaleToOne(ratios));
}

/** 트리를 정규화한다. 저장한 트리를 받을 때나 손으로 만든 트리에 쓴다. */
export function normalizeLayout(node: LayoutNode): LayoutNode {
  // 칸이 없는 트리는 만들 수 없으므로(빈 split은 검증에서 걸린다) 그대로 둔다.
  return clean(node) ?? node;
}

/** 뿌리 바로 아래에 붙이는 길: 세로로 쌓는다. */
const STACK: SplitDirection = "vertical";

/**
 * 칸을 더한다. 뿌리가 세로 split이면 끝에 더하고, 아니면(leaf, 가로 split) 뿌리와 새 칸을 세로 split으로 감싼다.
 * 새 칸은 그 split의 자식 n개 중 1/n을 받고 나머지는 같은 비율로 줄인다. 칸 수 한도는 보지 않는다 (보드 store가 본다).
 */
export function addPanel(node: LayoutNode, panelId: string): LayoutNode {
  const siblings =
    node.type === "split" && node.direction === STACK
      ? { children: node.children, ratios: node.ratios }
      : { children: [node], ratios: [1] };
  const share = 1 / (siblings.children.length + 1);
  return normalizeLayout(
    split(
      STACK,
      [...siblings.children, leaf(panelId)],
      [...scaleToOne(siblings.ratios).map((r) => r * (1 - share)), share],
    ),
  );
}

/** 칸을 뺀다. 형제가 그 몫을 비율대로 나눠 갖는다. 마지막 칸을 빼면 null */
export function removePanel(
  node: LayoutNode,
  panelId: string,
): LayoutNode | null {
  const drop = (n: LayoutNode): LayoutNode | null =>
    n.type === "leaf"
      ? n.panelId === panelId
        ? null
        : n
      : (() => {
          const kept = n.children.map(drop);
          return split(
            n.direction,
            kept.filter((c): c is LayoutNode => c !== null),
            n.ratios.filter((_, i) => kept[i] !== null),
          );
        })();
  return clean(drop(node));
}

const EDGE_DIRECTION: Record<DropEdge, SplitDirection> = {
  left: "horizontal",
  right: "horizontal",
  top: "vertical",
  bottom: "vertical",
};

/** 대상 칸의 이 변에 놓으면 대상보다 앞(왼쪽·위)에 들어가는지 */
const BEFORE: Record<DropEdge, boolean> = {
  left: true,
  top: true,
  right: false,
  bottom: false,
};

/** 대상 leaf 옆(edge 쪽)에 칸을 넣는다. 대상이 없으면 그대로 */
function insertBeside(
  node: LayoutNode,
  targetId: string,
  panelId: string,
  edge: DropEdge,
): LayoutNode {
  const direction = EDGE_DIRECTION[edge];
  const before = BEFORE[edge];
  if (node.type === "leaf") {
    if (node.panelId !== targetId) return node;
    // 방향이 다른 자리(또는 뿌리)면 대상을 split으로 감싼다.
    const pair = before ? [leaf(panelId), node] : [node, leaf(panelId)];
    return split(direction, pair, [0.5, 0.5]);
  }
  const index = node.children.findIndex(
    (c) => c.type === "leaf" && c.panelId === targetId,
  );
  if (index >= 0 && node.direction === direction) {
    // 같은 방향이면 형제로 넣고, 대상의 몫을 반씩 나눈다.
    const half = node.ratios[index] / 2;
    const at = before ? index : index + 1;
    const children = [...node.children];
    const ratios = [...node.ratios];
    ratios[index] = half;
    children.splice(at, 0, leaf(panelId));
    ratios.splice(at, 0, half);
    return split(node.direction, children, ratios);
  }
  return split(
    node.direction,
    node.children.map((c) => insertBeside(c, targetId, panelId, edge)),
    node.ratios,
  );
}

/**
 * 칸을 옮긴다: 원래 자리에서 빼서 대상 칸의 edge 쪽에 넣는다. 같은 방향의 split 안이면 형제로,
 * 아니면 대상을 split으로 감싼다. 대상과 같거나 둘 중 하나가 없으면 그대로 돌려준다.
 * 끄는 동안의 미리보기도 이 결과를 그린다.
 */
export function movePanel(
  node: LayoutNode,
  panelId: string,
  targetId: string,
  edge: DropEdge,
): LayoutNode {
  if (panelId === targetId || !hasPanel(node, panelId)) return node;
  if (!hasPanel(node, targetId)) return node;
  const rest = removePanel(node, panelId);
  if (!rest) return node;
  return normalizeLayout(insertBeside(rest, targetId, panelId, edge));
}

/**
 * 경계 하나를 옮긴 비율. ratios[index]와 ratios[index + 1] 사이 경계를 delta만큼 뒤(오른쪽·아래)로 민다.
 * 두 칸 모두 MIN_RATIO 아래로 줄지 않게 자른다. 끄는 동안 DOM에 적을 값과 키보드(±RATIO_STEP)가 같이 쓴다.
 */
export function moveDivider(
  ratios: readonly number[],
  index: number,
  delta: number,
  min = MIN_RATIO,
): number[] {
  const a = ratios[index];
  const b = ratios[index + 1];
  if (a === undefined || b === undefined) return [...ratios];
  const pair = a + b;
  const next = Math.min(pair - min, Math.max(min, a + delta));
  const out = [...ratios];
  out[index] = next;
  out[index + 1] = pair - next;
  return out;
}

/**
 * 경로의 split 비율을 바꾼다 (크기 조절을 놓을 때). 합은 1로 맞춘다.
 * 경로가 split이 아니거나 수가 자식 수와 다르면 그대로 돌려준다.
 */
export function setSplitRatios(
  node: LayoutNode,
  path: NodePath,
  ratios: readonly number[],
): LayoutNode {
  const target = nodeAt(node, path);
  if (target?.type !== "split" || target.children.length !== ratios.length)
    return node;
  const replace = (n: LayoutNode, depth: number): LayoutNode => {
    if (n.type !== "split") return n;
    if (depth === path.length)
      return split(n.direction, n.children, scaleToOne(ratios));
    const at = path[depth];
    return split(
      n.direction,
      n.children.map((c, i) => (i === at ? replace(c, depth + 1) : c)),
      n.ratios,
    );
  };
  return replace(node, 0);
}

/** 칸 영역 안의 점에서 가장 가까운 변. 끌어 놓을 자리를 정한다. */
export function nearestEdge(
  rect: { left: number; top: number; width: number; height: number },
  point: { x: number; y: number },
): DropEdge {
  // 가로·세로 길이가 달라도 같은 기준이 되게 영역 크기로 나눈 거리로 잰다.
  const x = rect.width > 0 ? (point.x - rect.left) / rect.width : 0.5;
  const y = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5;
  const distances: [DropEdge, number][] = [
    ["left", x],
    ["right", 1 - x],
    ["top", y],
    ["bottom", 1 - y],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}
