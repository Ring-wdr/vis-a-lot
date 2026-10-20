import type { ChartSpec, ItemSize } from "@/shared/api/types";
// item grid의 치수 계산. 화면 배치와 서버에 요청할 PNG 크기가 같은 계산을 쓴다.

export const GRID_GAP = 12;
export const ITEM_TOOLBAR_HEIGHT = 30;
export const GRID_FOOTER_HEIGHT = 44;

export function itemSizeFor(
  area: { width: number; height: number },
  grid: ChartSpec["grid"],
): ItemSize {
  const height = area.height - GRID_FOOTER_HEIGHT;
  const cellWidth = (area.width - GRID_GAP * (grid.cols - 1)) / grid.cols;
  const cellHeight = (height - GRID_GAP * (grid.rows - 1)) / grid.rows;
  return {
    width: Math.max(50, Math.floor(cellWidth) - 2),
    height: Math.max(50, Math.floor(cellHeight) - ITEM_TOOLBAR_HEIGHT - 2),
  };
}
