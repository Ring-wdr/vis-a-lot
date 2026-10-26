import type { ChartSpec, ItemSize } from "@/shared/api/types";
import { currentPixelRatio } from "@/shared/lib/pixel-ratio";
// item grid의 치수 계산. 화면 배치와 서버에 요청할 PNG 크기가 같은 계산을 쓴다.

export const GRID_GAP = 12;
export const GRID_FOOTER_HEIGHT = 44;
/** grid 오른쪽의 페이지 스크롤바 폭과 간격. 페이지가 하나여도 자리는 비워 둬 item 크기가 바뀌지 않게 한다. */
export const PAGE_SCROLLER_WIDTH = 16;
export const PAGE_SCROLLER_GAP = 8;

/** 서버가 그리는 섬네일 크기. 크게 보기 하단 목록의 칸 크기가 된다. */
export const THUMBNAIL_WIDTH = 128;
/** 섬네일 사이 간격. CSS의 .thumbList gap과 같아야 개수 계산이 맞는다. */
export const THUMBNAIL_GAP = 8;
/** 섬네일 테두리(1px × 2) */
const THUMBNAIL_BORDER = 2;
/** 서버가 받는 PNG 한 변의 최대 크기 */
const MAX_PNG_SIDE = 2000;

/** 하단 목록 폭에 들어가는 섬네일 수. 폭이 넓을수록 많아진다. */
export function thumbnailCountFor(width: number) {
  const slot = THUMBNAIL_WIDTH + THUMBNAIL_BORDER + THUMBNAIL_GAP;
  return Math.max(1, Math.floor((width + THUMBNAIL_GAP) / slot));
}

/** 배율이 1보다 크면 붙인다. 서버는 PNG를 그 배율로 촘촘하게 그리고, 크기(CSS 픽셀)는 그대로 둔다. */
function withRatio(size: ItemSize, pixelRatio: number): ItemSize {
  return pixelRatio > 1 ? { ...size, pixelRatio } : size;
}

/** 크게 보기 item 칸에 맞는 PNG 크기. 도구는 차트 위에 떠 있어 카드 전체를 PNG가 쓴다 (테두리 1px × 2만 뺀다). */
export function detailSizeFor(
  area: { width: number; height: number },
  pixelRatio = currentPixelRatio(),
): ItemSize {
  return withRatio(
    {
      width: Math.min(MAX_PNG_SIDE, Math.max(50, Math.floor(area.width) - 2)),
      height: Math.min(MAX_PNG_SIDE, Math.max(50, Math.floor(area.height) - 2)),
    },
    pixelRatio,
  );
}

export function itemSizeFor(
  area: { width: number; height: number },
  grid: ChartSpec["grid"],
  pixelRatio = currentPixelRatio(),
): ItemSize {
  const height = area.height - GRID_FOOTER_HEIGHT;
  const width = area.width - PAGE_SCROLLER_WIDTH - PAGE_SCROLLER_GAP;
  const cellWidth = (width - GRID_GAP * (grid.cols - 1)) / grid.cols;
  const cellHeight = (height - GRID_GAP * (grid.rows - 1)) / grid.rows;
  // 브라우저를 많이 축소하면 칸이 서버 한도보다 커진다. PNG는 한도로 그리고 칸에 맞춰 늘려 보인다.
  return withRatio(
    {
      width: Math.min(MAX_PNG_SIDE, Math.max(50, Math.floor(cellWidth) - 2)),
      height: Math.min(MAX_PNG_SIDE, Math.max(50, Math.floor(cellHeight) - 2)),
    },
    pixelRatio,
  );
}
