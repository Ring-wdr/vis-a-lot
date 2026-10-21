import type { ChartSpec, ItemSize } from "@/shared/api/types";
// item grid의 치수 계산. 화면 배치와 서버에 요청할 PNG 크기가 같은 계산을 쓴다.

export const GRID_GAP = 12;
export const ITEM_TOOLBAR_HEIGHT = 30;
export const GRID_FOOTER_HEIGHT = 44;
/** grid 오른쪽의 페이지 스크롤바 폭과 간격. 페이지가 하나여도 자리는 비워 둬 item 크기가 바뀌지 않게 한다. */
export const PAGE_SCROLLER_WIDTH = 16;
export const PAGE_SCROLLER_GAP = 8;

export function itemSizeFor(
  area: { width: number; height: number },
  grid: ChartSpec["grid"],
): ItemSize {
  const height = area.height - GRID_FOOTER_HEIGHT;
  const width = area.width - PAGE_SCROLLER_WIDTH - PAGE_SCROLLER_GAP;
  const cellWidth = (width - GRID_GAP * (grid.cols - 1)) / grid.cols;
  const cellHeight = (height - GRID_GAP * (grid.rows - 1)) / grid.rows;
  return {
    width: Math.max(50, Math.floor(cellWidth) - 2),
    height: Math.max(50, Math.floor(cellHeight) - ITEM_TOOLBAR_HEIGHT - 2),
  };
}
