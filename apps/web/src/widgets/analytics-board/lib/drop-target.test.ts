import type { ClientRect, DroppableContainer } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import { dropCollision, keyboardDrop } from "./drop-target";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

// 1×2: a(왼쪽) | b(오른쪽), 그 아래 c가 보드 폭 전체
const RECTS = new Map<string, ClientRect>([
  ["a", rect(0, 0, 400, 300)],
  ["b", rect(400, 0, 400, 300)],
  ["c", rect(0, 300, 800, 300)],
]);
const containers = [...RECTS.keys()].map(
  (id) => ({ id, disabled: false }) as unknown as DroppableContainer,
);

const collide = (
  point: { x: number; y: number } | null,
  collisionRect = rect(0, 0, 10, 10),
) =>
  dropCollision({
    active: { id: "a" } as never,
    collisionRect,
    droppableRects: RECTS,
    droppableContainers: containers,
    pointerCoordinates: point,
  });

describe("dropCollision", () => {
  it("포인터 아래 칸과 가장 가까운 변을 고른다", () => {
    expect(collide({ x: 410, y: 150 })).toMatchObject([
      { id: "b", data: { edge: "left" } },
    ]);
    expect(collide({ x: 600, y: 290 })).toMatchObject([
      { id: "b", data: { edge: "bottom" } },
    ]);
    expect(collide({ x: 790, y: 450 })).toMatchObject([
      { id: "c", data: { edge: "right" } },
    ]);
  });

  it("끄는 칸 자신이나 칸 밖은 대상이 아니다", () => {
    expect(collide({ x: 100, y: 100 })).toEqual([]);
    expect(collide({ x: 900, y: 100 })).toEqual([]);
  });

  it("포인터가 없으면(키보드) 손잡이 영역의 가운데로 고른다", () => {
    expect(collide(null, rect(395, 140, 30, 20))).toMatchObject([
      { id: "b", data: { edge: "left" } },
    ]);
  });
});

/** 손잡이(20×20)가 가운데 at에 있을 때 화살표를 누른 뒤 손잡이 가운데 */
function press(code: string, at: { x: number; y: number }) {
  const collisionRect = rect(at.x - 10, at.y - 10, 20, 20);
  let prevented = false;
  const next = keyboardDrop(
    {
      code,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent,
    {
      active: "a",
      currentCoordinates: { x: collisionRect.left, y: collisionRect.top },
      context: {
        collisionRect,
        droppableRects: RECTS,
        droppableContainers: { getEnabled: () => containers },
      } as never,
    },
  );
  return {
    prevented,
    center: next ? { x: next.x + 10, y: next.y + 10 } : undefined,
  };
}

describe("keyboardDrop", () => {
  it("자기 칸에서는 그 방향의 칸으로 가서 오던 쪽 변을 고른다", () => {
    // a의 가운데에서 → : b의 왼쪽 변 자리
    const right = press("ArrowRight", { x: 200, y: 150 });
    expect(right.prevented).toBe(true);
    expect(right.center).toEqual({ x: 460, y: 150 });
    expect(collide(null, rect(450, 140, 20, 20))).toMatchObject([
      { id: "b", data: { edge: "left" } },
    ]);
    // ↓ : c의 위 변. 변을 따라가는 축은 지금 자리를 따른다 (가운데 쪽으로 자른다).
    const down = press("ArrowDown", { x: 200, y: 150 });
    expect(down.center).toEqual({ x: 240, y: 345 });
    expect(collide(null, rect(230, 335, 20, 20))).toMatchObject([
      { id: "c", data: { edge: "top" } },
    ]);
  });

  it("대상 칸 안에서는 그 방향의 변을 고르고, 같은 방향이면 다음 칸으로 넘어간다", () => {
    // b의 왼쪽 변에서 → : b의 오른쪽 변
    expect(press("ArrowRight", { x: 460, y: 150 }).center).toEqual({
      x: 740,
      y: 150,
    });
    // b의 오른쪽 변에서 ↓ : b의 아래 변
    expect(press("ArrowDown", { x: 740, y: 150 }).center).toEqual({
      x: 680,
      y: 255,
    });
    // b의 아래 변에서 ↓ : c의 위 변
    expect(press("ArrowDown", { x: 680, y: 255 }).center).toEqual({
      x: 560,
      y: 345,
    });
    // b의 오른쪽 변에서 → : 더 갈 칸이 없다
    expect(press("ArrowRight", { x: 740, y: 150 }).center).toBeUndefined();
  });

  it("그 방향에 칸이 없거나 화살표가 아니면 그대로다", () => {
    expect(press("ArrowUp", { x: 200, y: 150 }).center).toBeUndefined();
    const other = press("KeyA", { x: 200, y: 150 });
    expect(other).toEqual({ prevented: false, center: undefined });
  });
});
