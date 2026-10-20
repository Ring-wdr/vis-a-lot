// PNG 좌표 ↔ 데이터 좌표. metadata의 그림 영역과 축 범위만으로 계산한다.

import { invertAxis } from "@/features/item-tooltip/lib/strategies";
import type { ItemMeta } from "@/shared/api/types";

export type Point = { x: number; y: number };

/** 그림 영역 안으로 좌표를 붙잡는다. 도형과 확대 영역이 그림 밖으로 나가지 않게 한다. */
export function clampToPlot(meta: ItemMeta, p: Point): Point {
  const { plot } = meta;
  return {
    x: Math.min(plot.left + plot.width, Math.max(plot.left, p.x)),
    y: Math.min(plot.top + plot.height, Math.max(plot.top, p.y)),
  };
}

export function pxToData(meta: ItemMeta, p: Point): [number, number] {
  const { plot } = meta;
  return [
    invertAxis(meta.x, plot.left, plot.width, p.x, false),
    invertAxis(meta.y, plot.top, plot.height, p.y, true),
  ];
}

/** 화면 이벤트 좌표 → PNG 좌표. 이미지가 늘어나 보여도 PNG 기준으로 환산한다. */
export function eventToPng(
  e: { clientX: number; clientY: number },
  el: Element,
  image: { width: number; height: number },
): Point {
  const rect = el.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * image.width) / rect.width,
    y: ((e.clientY - rect.top) * image.height) / rect.height,
  };
}
