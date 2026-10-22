// PNG 안에 그리는 legend 상자. 위·아래는 가로 [● 값 ● 값 …], 왼쪽·오른쪽은 세로 목록이다.
// 각 항목의 위치를 metadata로 넘겨, 화면이 그 자리에 색 선택 버튼을 겹칠 수 있게 한다.

import { THEME } from "./theme";

export type Rect = { x: number; y: number; width: number; height: number };

export const LEGEND_POSITIONS = ["top", "bottom", "left", "right"] as const;
export type LegendPosition = (typeof LEGEND_POSITIONS)[number];

export type LegendInput = {
  title: string;
  values: string[];
  colors: string[];
  /** 없으면 위 */
  position?: LegendPosition;
  /** 체크박스로 끈 값. 표시는 남기되 속을 비우고 글자를 흐리게 그린다. */
  hidden?: readonly string[];
};

/** legend 인덱스별로 끈 값인지. 렌더러가 그 값의 점(막대/상자)을 건너뛴다. */
export function hiddenIndexes(legend: LegendInput | undefined) {
  return legend?.values.map((v) => legend.hidden?.includes(v) ?? false) ?? [];
}

export type LegendMeta = {
  title: string;
  /** 전체 legend 값과 색 (상자에 다 들어가지 못한 값 포함) */
  values: string[];
  colors: string[];
  box: Rect;
  /** 화면에 다 들어가지 못한 항목은 빠지고 hidden 수로만 남는다. */
  entries: {
    value: string;
    color: string;
    index: number;
    rect: Rect;
    /** 색 표시(●)의 가운데 */
    marker: { x: number; y: number };
    visible: boolean;
  }[];
  hidden: number;
};

/** 가로 legend 상자가 차지하는 세로 공간 (상자 + 여백) */
export const LEGEND_SPACE = 26;

const BOX_HEIGHT = 20;
const ROW_HEIGHT = 18;
const MARKER_R = 5;
const PAD = 6;
const GAP = 10;
/** 세로 legend 폭의 상한 (PNG 폭 대비) */
const SIDE_MAX_RATIO = 0.3;
const SIDE_MIN_WIDTH = 60;

type Ctx = OffscreenCanvasRenderingContext2D;

type Plot = { left: number; top: number; width: number; height: number };

/** 왼쪽·오른쪽 legend가 차지할 폭 (상자 + 그림 영역과의 간격) */
function sideWidth(ctx: Ctx, legend: LegendInput, width: number) {
  ctx.save();
  ctx.font = `11px ${THEME.font}`;
  const widest = Math.max(
    ctx.measureText(legend.title).width,
    ...legend.values.map((v) => MARKER_R * 2 + 4 + ctx.measureText(v).width),
  );
  ctx.restore();
  // 그림 영역은 정수 픽셀이어야 한다 (scatter metadata가 픽셀 칸 번호로 점을 찾는다).
  const max = Math.max(SIDE_MIN_WIDTH, Math.floor(width * SIDE_MAX_RATIO));
  return Math.min(max, Math.ceil(widest + PAD * 2)) + GAP;
}

/**
 * 축·제목 여백과 legend 자리를 빼고 남은 그림 영역.
 * yLabelWidth는 y축 눈금 글자 중 가장 긴 폭이다.
 */
export function framePlot(
  ctx: Ctx,
  width: number,
  height: number,
  yLabelWidth: number,
  legend: LegendInput | undefined,
): Plot {
  const position = legend ? (legend.position ?? "top") : undefined;
  const side =
    legend && (position === "left" || position === "right")
      ? sideWidth(ctx, legend, width)
      : 0;
  const left = Math.ceil(yLabelWidth + 14) + (position === "left" ? side : 0);
  const top = 28 + (position === "top" ? LEGEND_SPACE : 0);
  return {
    left,
    top,
    width: Math.max(10, width - left - 14 - (position === "right" ? side : 0)),
    height: Math.max(
      10,
      height - top - 26 - (position === "bottom" ? LEGEND_SPACE : 0),
    ),
  };
}

/** framePlot이 비워 둔 자리에 legend를 그린다. */
export function drawLegendAround(
  ctx: Ctx,
  legend: LegendInput,
  plot: Plot,
  yLabelWidth: number,
): LegendMeta {
  switch (legend.position ?? "top") {
    case "top":
      return drawLegend(ctx, legend, plot.left, 24, plot.width);
    case "bottom":
      // x축 눈금 글자(26px) 아래
      return drawLegend(
        ctx,
        legend,
        plot.left,
        plot.top + plot.height + 26,
        plot.width,
      );
    case "left": {
      const x = 4;
      const width = plot.left - Math.ceil(yLabelWidth + 14) - GAP;
      return drawVerticalLegend(ctx, legend, x, plot.top, width, plot.height);
    }
    case "right": {
      const x = plot.left + plot.width + GAP;
      const width = ctx.canvas.width - x - 4;
      return drawVerticalLegend(ctx, legend, x, plot.top, width, plot.height);
    }
  }
}

function truncate(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth)
    end--;
  return `${text.slice(0, end)}…`;
}

function drawBox(ctx: Ctx, box: Rect) {
  ctx.fillStyle = THEME.surface;
  ctx.strokeStyle = THEME.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(box.x + 0.5, box.y + 0.5, box.width, box.height, 4);
  ctx.fill();
  ctx.stroke();
}

function drawMarker(
  ctx: Ctx,
  cx: number,
  cy: number,
  color: string,
  visible: boolean,
) {
  // 마커는 데이터 색, 글자는 텍스트 색 (텍스트에 데이터 색을 입히지 않는다)
  ctx.beginPath();
  if (!visible) {
    // 끈 값은 속이 빈 테두리만 그린다.
    ctx.arc(cx, cy, MARKER_R - 1, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  ctx.arc(cx, cy, MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = THEME.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** 세로 legend: 제목 한 줄 아래로 항목을 한 줄씩. 높이를 넘치면 "+N"으로 줄인다. */
function drawVerticalLegend(
  ctx: Ctx,
  legend: LegendInput,
  x: number,
  y: number,
  width: number,
  maxHeight: number,
): LegendMeta {
  ctx.save();
  ctx.font = `11px ${THEME.font}`;
  const textWidth = width - PAD * 2;
  const rowsFit = Math.max(
    0,
    Math.floor((maxHeight - PAD * 2 - ROW_HEIGHT) / ROW_HEIGHT),
  );
  // 다 못 넣으면 마지막 줄은 "+N" 자리로 비운다.
  const shown =
    legend.values.length <= rowsFit
      ? legend.values.length
      : Math.max(0, rowsFit - 1);
  const hidden = legend.values.length - shown;
  const rows = shown + (hidden ? 1 : 0);
  const box = {
    x,
    y,
    width,
    height: PAD * 2 + ROW_HEIGHT * (rows + 1),
  };
  drawBox(ctx, box);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = THEME.textMuted;
  ctx.fillText(
    truncate(ctx, legend.title, textWidth),
    x + PAD,
    y + PAD + ROW_HEIGHT / 2,
  );
  const entries: LegendMeta["entries"] = [];
  for (let i = 0; i < shown; i++) {
    const rowY = y + PAD + ROW_HEIGHT * (i + 1);
    const midY = rowY + ROW_HEIGHT / 2;
    const cx = x + PAD + MARKER_R;
    const visible = !legend.hidden?.includes(legend.values[i]);
    drawMarker(ctx, cx, midY, legend.colors[i], visible);
    ctx.fillStyle = visible ? THEME.textSecondary : THEME.textMuted;
    ctx.fillText(
      truncate(ctx, legend.values[i], textWidth - MARKER_R * 2 - 4),
      cx + MARKER_R + 4,
      midY,
    );
    entries.push({
      value: legend.values[i],
      color: legend.colors[i],
      index: i,
      rect: { x: x + 2, y: rowY, width: width - 4, height: ROW_HEIGHT },
      marker: { x: cx, y: midY },
      visible,
    });
  }
  if (hidden) {
    ctx.fillStyle = THEME.textMuted;
    ctx.fillText(
      `+${hidden}`,
      x + PAD,
      y + PAD + ROW_HEIGHT * (shown + 1) + ROW_HEIGHT / 2,
    );
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

/** 가로 legend: [제목 ● 값 ● 값 …]. 폭을 넘치면 "+N"으로 줄인다. */
function drawLegend(
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
      marker: { x: cursor + MARKER_R, y: y + BOX_HEIGHT / 2 },
      visible: !legend.hidden?.includes(label),
    });
    cursor += width + GAP;
  }
  const hidden = legend.values.length - entries.length;
  const boxWidth = Math.min(
    maxWidth,
    cursor - x - GAP + PAD + (hidden ? moreWidth : 0),
  );
  const box = { x, y, width: boxWidth, height: BOX_HEIGHT };

  drawBox(ctx, box);

  const midY = y + BOX_HEIGHT / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = THEME.textMuted;
  ctx.fillText(titleText, x + PAD, midY);
  for (const entry of entries) {
    const cx = entry.marker.x;
    drawMarker(ctx, cx, midY, entry.color, entry.visible);
    ctx.fillStyle = entry.visible ? THEME.textSecondary : THEME.textMuted;
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
