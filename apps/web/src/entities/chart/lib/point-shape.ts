// 점 모양을 SVG path로. 서버가 PNG에 그리는 점(server/render/style.ts의 pathPoint)과 같은 꼭짓점이다.
// legend 색 표시와 툴팁의 가까운 점 표시가 PNG 점과 같은 모양을 보이게 한다.

import type { PointShape } from "../model/chart-options";

type Vertex = readonly [number, number];

/** 반지름 1 정다각형 꼭짓점. 각도 0이 위쪽이고 시계 방향이다 (y는 아래로). */
function polygon(count: number, radius = (_k: number) => 1, turn = 0) {
  return Array.from({ length: count }, (_, k): Vertex => {
    const a = ((k + turn) / count) * Math.PI * 2;
    return [Math.sin(a) * radius(k), -Math.cos(a) * radius(k)];
  });
}

const VERTICES: Record<Exclude<PointShape, "circle" | "cross">, Vertex[]> = {
  square: [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
  triangle: [
    [0, -1],
    [0.866, 0.5],
    [-0.866, 0.5],
  ],
  diamond: [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ],
  downTriangle: polygon(3, undefined, 1.5),
  leftTriangle: polygon(3, undefined, 2.25),
  rightTriangle: polygon(3, undefined, 0.75),
  hexagon: polygon(6),
  star: polygon(10, (k) => (k % 2 === 0 ? 1 : 0.45)),
};

const fmt = (v: number) => String(Math.round(v * 1000) / 1000 + 0);

/** 가운데 (0, 0), 반지름 r인 점 모양의 SVG path. cross는 넓이가 없어 stroke로만 보인다. */
export function pointShapePath(shape: PointShape, r: number) {
  if (shape === "circle") {
    return `M${fmt(r)} 0A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(-r)} 0A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(r)} 0Z`;
  }
  if (shape === "cross") {
    const a = fmt(r);
    const b = fmt(-r);
    return `M${b} ${b}L${a} ${a}M${a} ${b}L${b} ${a}`;
  }
  const vs = VERTICES[shape];
  return `${vs.map(([x, y], k) => `${k === 0 ? "M" : "L"}${fmt(x * r)} ${fmt(y * r)}`).join("")}Z`;
}

/** 채울 수 없는 모양 (선으로만 그린다) */
export const strokeOnly = (shape: PointShape) => shape === "cross";
