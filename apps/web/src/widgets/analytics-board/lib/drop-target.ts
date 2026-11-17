// 칸을 끌어 놓을 자리: 대상 칸과 그 칸의 가장 가까운 변.
// 포인터는 포인터 자리로, 키보드는 손잡이 자리(끄는 동안 움직이는 손잡이의 가운데)로 고른다.

import type {
  ClientRect,
  CollisionDetection,
  KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  type DropEdge,
  nearestEdge,
} from "@/entities/workspace/lib/layout-tree";

type Coordinates = { x: number; y: number };

const center = (r: ClientRect): Coordinates => ({
  x: r.left + r.width / 2,
  y: r.top + r.height / 2,
});

const contains = (r: ClientRect, p: Coordinates) =>
  p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/** 충돌 결과의 data에 붙이는 놓을 변 */
export type DropCollisionData = { edge: DropEdge };

/**
 * 점 아래의 칸 하나를 대상으로 고르고, 그 칸에서 가장 가까운 변을 data.edge에 담는다.
 * 끄는 칸 자신은 대상이 아니다 (놓아도 그대로다).
 */
export const dropCollision: CollisionDetection = ({
  active,
  collisionRect,
  droppableRects,
  droppableContainers,
  pointerCoordinates,
}) => {
  const point = pointerCoordinates ?? center(collisionRect);
  for (const container of droppableContainers) {
    if (container.id === active.id || container.disabled) continue;
    const rect = droppableRects.get(container.id);
    if (!rect || !contains(rect, point)) continue;
    const edge = nearestEdge(rect, point);
    return [
      {
        id: container.id,
        data: { droppableContainer: container, value: 0, edge },
      },
    ];
  }
  return [];
};

/** 변 자리: 변에서 들어간 몫. 가장 가까운 변이 그 변이 되는 자리다. */
const INSET = 0.15;
/** 변을 따라가는 축에서 지금 자리를 따라가되, 다른 변이 더 가까워지지 않게 가운데 쪽으로 자르는 몫 */
const ALONG = 0.3;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** 칸의 edge 변 자리. 변을 따라가는 축은 지금 자리(from)를 되도록 따른다. */
function edgeSpot(r: ClientRect, edge: DropEdge, from: Coordinates) {
  const x = clamp(from.x, r.left + r.width * ALONG, r.right - r.width * ALONG);
  const y = clamp(
    from.y,
    r.top + r.height * ALONG,
    r.bottom - r.height * ALONG,
  );
  switch (edge) {
    case "left":
      return { x: r.left + r.width * INSET, y };
    case "right":
      return { x: r.right - r.width * INSET, y };
    case "top":
      return { x, y: r.top + r.height * INSET };
    case "bottom":
      return { x, y: r.bottom - r.height * INSET };
  }
}

const ARROWS: Record<string, DropEdge> = {
  ArrowRight: "right",
  ArrowLeft: "left",
  ArrowDown: "bottom",
  ArrowUp: "top",
};
const OPPOSITE: Record<DropEdge, DropEdge> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};
const STEP: Record<DropEdge, Coordinates> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  bottom: { x: 0, y: 1 },
  top: { x: 0, y: -1 },
};

/** rect 바깥 dir 쪽에 있는 칸 중 가장 가까운 칸. 옆으로 벗어난 거리는 지금 자리(from)에서 두 배로 친다. */
function nextPanel(
  rects: [string | number, ClientRect][],
  from: ClientRect,
  point: Coordinates,
  dir: DropEdge,
) {
  const d = STEP[dir];
  let best: { id: string | number; rect: ClientRect; score: number } | null =
    null;
  for (const [id, r] of rects) {
    const beyond =
      dir === "right"
        ? r.left >= from.right - 1
        : dir === "left"
          ? r.right <= from.left + 1
          : dir === "bottom"
            ? r.top >= from.bottom - 1
            : r.bottom <= from.top + 1;
    if (!beyond) continue;
    const c = center(r);
    const ahead = (c.x - point.x) * d.x + (c.y - point.y) * d.y;
    const aside = Math.abs((c.x - point.x) * d.y + (c.y - point.y) * d.x);
    const score = ahead + aside * 2;
    if (!best || score < best.score) best = { id, rect: r, score };
  }
  return best;
}

/**
 * 키보드 화살표로 대상 칸과 변을 고른다. 지금 자리(손잡이 가운데)가 놓인 칸과 변에서 시작해
 * - 아직 대상이 없으면(자기 칸) 그 방향의 가장 가까운 칸으로 가서, 오던 쪽 변을 고른다.
 * - 고른 변과 같은 방향이면 그 방향의 다음 칸으로 넘어가 오던 쪽 변을 고른다.
 * - 아니면 같은 칸에서 그 방향의 변을 고른다.
 * 예: 1×2의 왼쪽 칸에서 → 를 누르면 오른쪽 칸의 왼쪽 변, 한 번 더 누르면 오른쪽 칸의 오른쪽 변이다.
 */
export const keyboardDrop: KeyboardCoordinateGetter = (
  event,
  { active, context },
) => {
  const dir = ARROWS[event.code];
  if (!dir) return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const point = center(collisionRect);
  const others: [string | number, ClientRect][] = [];
  let home: ClientRect | undefined;
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    if (container.id === active) home = rect;
    else others.push([container.id, rect]);
  }
  const target = others.find(([, r]) => contains(r, point));
  const edge = target ? nearestEdge(target[1], point) : undefined;

  let next: { rect: ClientRect; edge: DropEdge } | undefined;
  if (target && edge !== dir) next = { rect: target[1], edge: dir };
  else {
    const from = target?.[1] ?? home;
    if (!from) return undefined;
    const found = nextPanel(others, from, point, dir);
    if (found) next = { rect: found.rect, edge: OPPOSITE[dir] };
  }
  if (!next) return undefined;
  const spot = edgeSpot(next.rect, next.edge, point);
  // 돌려주는 값은 손잡이 영역의 왼쪽 위다. 가운데가 변 자리에 오게 한다.
  return {
    x: spot.x - collisionRect.width / 2,
    y: spot.y - collisionRect.height / 2,
  };
};
