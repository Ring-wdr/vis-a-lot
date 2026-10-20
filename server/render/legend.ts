// PNG 안에 그리는 legend 상자 [● 값 ● 값 …].
// 각 항목의 위치를 metadata로 넘겨, 화면이 그 자리에 색 선택 버튼을 겹칠 수 있게 한다.

import { THEME } from "./theme";

export type Rect = { x: number; y: number; width: number; height: number };

export type LegendInput = {
  title: string;
  values: string[];
  colors: string[];
};

export type LegendMeta = {
  title: string;
  /** 전체 legend 값과 색 (상자에 다 들어가지 못한 값 포함) */
  values: string[];
  colors: string[];
  box: Rect;
  /** 화면에 다 들어가지 못한 항목은 빠지고 hidden 수로만 남는다. */
  entries: { value: string; color: string; index: number; rect: Rect }[];
  hidden: number;
};

/** legend 상자가 차지하는 세로 공간 (상자 + 아래 여백) */
export const LEGEND_SPACE = 26;

const BOX_HEIGHT = 20;
const MARKER_R = 5;
const PAD = 6;
const GAP = 10;

type Ctx = OffscreenCanvasRenderingContext2D;

export function drawLegend(
  ctx: Ctx,
  legend: LegendInput,
  x: number,
  y: number,
  maxWidth: number,
): LegendMeta {
  ctx.save();
  ctx.font = `11px ${THEME.font}`;
  const titleText = `${legend.title}`;
  const titleWidth = ctx.measureText(titleText).width;

  // 들어가는 만큼만 항목을 놓고, 넘치면 "+N"으로 줄인다.
  const entries: LegendMeta["entries"] = [];
  let cursor = x + PAD + titleWidth + GAP;
  const moreWidth = ctx.measureText("+8").width + GAP;
  for (let i = 0; i < legend.values.length; i++) {
    const label = legend.values[i];
    const width = MARKER_R * 2 + 4 + ctx.measureText(label).width;
    const reserve = i < legend.values.length - 1 ? moreWidth : 0;
    if (cursor + width + reserve > x + maxWidth - PAD) break;
    entries.push({
      value: label,
      color: legend.colors[i],
      index: i,
      rect: { x: cursor - 2, y, width: width + 4, height: BOX_HEIGHT },
    });
    cursor += width + GAP;
  }
  const hidden = legend.values.length - entries.length;
  const boxWidth = Math.min(
    maxWidth,
    cursor - x - GAP + PAD + (hidden ? moreWidth : 0),
  );
  const box = { x, y, width: boxWidth, height: BOX_HEIGHT };

  ctx.fillStyle = THEME.surface;
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(box.x + 0.5, box.y + 0.5, box.width, box.height, 4);
  ctx.fill();
  ctx.stroke();

  const midY = y + BOX_HEIGHT / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = THEME.textMuted;
  ctx.fillText(titleText, x + PAD, midY);
  for (const entry of entries) {
    const cx = entry.rect.x + 2 + MARKER_R;
    // 마커는 데이터 색, 글자는 텍스트 색 (텍스트에 데이터 색을 입히지 않는다)
    ctx.beginPath();
    ctx.arc(cx, midY, MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = entry.color;
    ctx.fill();
    ctx.strokeStyle = THEME.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = THEME.textSecondary;
    ctx.fillText(entry.value, cx + MARKER_R + 4, midY);
  }
  if (hidden) {
    ctx.fillStyle = THEME.textMuted;
    ctx.fillText(`+${hidden}`, cursor, midY);
  }
  ctx.restore();
  return {
    title: legend.title,
    values: legend.values,
    colors: legend.colors,
    box,
    entries,
    hidden,
  };
}
