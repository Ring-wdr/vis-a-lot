import type { ReactNode } from "react";
import { pointShapePath, strokeOnly } from "../lib/point-shape";
import type { PointShape } from "../model/chart-options";

/** 가운데(x, y)를 기준으로 path를 그리는 0 크기 SVG. 좌표는 런타임 값이라 style로 둔다. */
function Anchor({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      width={0}
      height={0}
      className="pointer-events-none absolute overflow-visible"
      style={{ left: x, top: y }}
    >
      {children}
    </svg>
  );
}

/**
 * legend 색 표시. PNG legend와 같은 모양·크기다: 켠 값은 반지름 r로 채우고(cross는 선),
 * 끈 값은 반지름 r - 1 테두리만 그린다.
 */
export function PointMarker({
  shape,
  radius,
  color,
  filled,
  x,
  y,
}: {
  shape: PointShape;
  radius: number;
  color: string;
  filled: boolean;
  x: number;
  y: number;
}) {
  const fill = filled && !strokeOnly(shape);
  return (
    <Anchor x={x} y={y}>
      <path
        d={pointShapePath(shape, filled ? radius : radius - 1)}
        fill={fill ? color : "none"}
        stroke={fill ? undefined : color}
        strokeWidth={fill ? undefined : 1.5}
      />
    </Anchor>
  );
}

/** 툴팁의 가까운 점 표시: 점 모양의 진한 테두리에 바탕색 테두리를 한 겹 두른다. */
export function PointRing({
  shape,
  x,
  y,
}: {
  shape: PointShape;
  x: number;
  y: number;
}) {
  const d = pointShapePath(shape, 4);
  return (
    <Anchor x={x} y={y}>
      <path d={d} fill="none" className="stroke-chart-paper stroke-6" />
      <path d={d} fill="none" className="stroke-chart-ink stroke-2" />
    </Anchor>
  );
}
