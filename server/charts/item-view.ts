// 확대/축소 계산. 범위는 모두 데이터 값 기준이다.

import type { ItemView } from "../render/scatter";

type Range = [number, number];

function sorted([a, b]: Range): Range {
  return a <= b ? [a, b] : [b, a];
}

function expand([a, b]: Range, ratio: number): Range {
  const center = (a + b) / 2;
  const half = ((b - a) / 2) * ratio;
  return [center - half, center + half];
}

function covers(outer: Range, inner: Range) {
  return outer[0] <= inner[0] && outer[1] >= inner[1];
}

export function zoomIn(x: Range, y: Range): ItemView | undefined {
  const nx = sorted(x);
  const ny = sorted(y);
  // 너무 작은 영역은 실수로 클릭한 것으로 보고 무시한다.
  if (nx[1] - nx[0] <= 0 || ny[1] - ny[0] <= 0) return undefined;
  return { x: nx, y: ny };
}

/** 현재 범위를 ratio배로 넓힌다. 전체 범위를 모두 덮으면 확대 해제(undefined). */
export function zoomOut(
  current: ItemView,
  full: ItemView | undefined,
  ratio: number,
): ItemView | undefined {
  const next = { x: expand(current.x, ratio), y: expand(current.y, ratio) };
  if (full && covers(next.x, full.x) && covers(next.y, full.y))
    return undefined;
  return next;
}
