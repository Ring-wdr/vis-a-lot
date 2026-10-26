// PNG 안에 그리는 legend 상자. 위·아래는 가로 [● 값 ● 값 …], 왼쪽·오른쪽은 세로 목록이다.
// 각 항목의 위치를 metadata로 넘겨, 화면이 그 자리에 색 선택 버튼을 겹칠 수 있게 한다.

import { xAxisSpace, yAxisSpace } from "./axis-style";
import {
  type ChartOptions,
  DEFAULT_OPTIONS,
  type LegendStyle,
} from "./options";
import { headerHeight, legendStyleOf, marginOf, surfaceOf } from "./style";
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
  /** legend 모양(options.legend, 글자 크기 자동 반영). 없으면 framePlot·drawLegendAround에 넘긴 options에서 */
  style?: LegendStyle;
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

/** 가로 legend 상자가 차지하는 세로 공간 (상자 + 여백). 기본 글자 크기일 때의 값이다. */
export const LEGEND_SPACE = 26;

const PAD = 6;
const GAP = 10;
/** 세로 legend 폭의 상한 (PNG 폭 대비) */
const SIDE_MAX_RATIO = 0.3;
const SIDE_MIN_WIDTH = 60;

type Ctx = OffscreenCanvasRenderingContext2D;

/** 캔버스의 CSS 픽셀 크기. 고해상도 PNG는 배율만큼 큰 캔버스에 scale을 걸어 그린다. */
function canvasSize(ctx: Ctx) {
  const scale = ctx.getTransform?.()?.a || 1;
  return {
    width: ctx.canvas.width / scale,
    height: ctx.canvas.height / scale,
  };
}

type Plot = { left: number; top: number; width: number; height: number };

/** legend 하나를 그릴 때의 치수와 색. 기본 글자 11px이면 상자 20, 줄 18, 표시 반지름 5다. */
type Look = {
  font: number;
  box: number;
  row: number;
  marker: number;
  textColor: string;
  border: boolean;
  borderColor: string;
  surface: string;
  reverse: boolean;
};

function styleOf(legend: LegendInput, o: ChartOptions) {
  return legend.style ?? legendStyleOf(o);
}

function lookOf(legend: LegendInput, o: ChartOptions): Look {
  const style = styleOf(legend, o);
  const font = Math.round(style.fontSize);
  return {
    font,
    box: font + 9,
    row: font + 7,
    marker: Math.max(3, Math.round(font * 0.45)),
    textColor: style.fontColor,
    border: style.border,
    borderColor: style.borderColor,
    surface: surfaceOf(o),
    reverse: style.reverse,
  };
}

/** legend를 그리는지 (값이 있고 legend.visible이 켜져 있음) */
export function legendShown(
  legend: LegendInput | undefined,
  o: ChartOptions = DEFAULT_OPTIONS,
): legend is LegendInput {
  return legend !== undefined && styleOf(legend, o).visible;
}

/** 가로 legend가 차지하는 세로 공간 (상자 + 여백). 기본 26 */
export function legendSpace(
  legend: LegendInput,
  o: ChartOptions = DEFAULT_OPTIONS,
) {
  return lookOf(legend, o).box + 6;
}

/** 그리는 순서. reverse면 뒤집지만 항목은 원래 인덱스를 그대로 가진다. */
function order(legend: LegendInput, look: Look) {
  const idx = legend.values.map((_, i) => i);
  return look.reverse ? idx.reverse() : idx;
}

/** 왼쪽·오른쪽 legend가 차지할 폭 (상자 + 그림 영역과의 간격) */
function sideWidth(ctx: Ctx, legend: LegendInput, width: number, look: Look) {
  ctx.save();
  ctx.font = `${look.font}px ${THEME.font}`;
  const widest = Math.max(
    ctx.measureText(legend.title).width,
    ...legend.values.map((v) => look.marker * 2 + 4 + ctx.measureText(v).width),
  );
  ctx.restore();
  // 그림 영역은 정수 픽셀이어야 한다 (scatter metadata가 픽셀 칸 번호로 점을 찾는다).
  const max = Math.max(SIDE_MIN_WIDTH, Math.floor(width * SIDE_MAX_RATIO));
  return Math.min(max, Math.ceil(widest + PAD * 2)) + GAP;
}

/**
 * 축·제목 여백과 legend 자리를 빼고 남은 그림 영역 (언제나 정수 픽셀).
 * yLabelWidth는 y축 눈금 글자 중 가장 긴 폭, xLabelWidth는 x 눈금 글자를 돌렸을 때 가장 긴 폭(모르면 60)이다.
 * options가 있으면 panel 여백, 제목 줄(숨김·부제목), legend 숨김·글자 크기, 축 숨김·눈금 글자 회전·축 제목을 반영한다.
 */
export function framePlot(
  ctx: Ctx,
  width: number,
  height: number,
  yLabelWidth: number,
  legend: LegendInput | undefined,
  options: ChartOptions = DEFAULT_OPTIONS,
  xLabelWidth?: number,
): Plot {
  const o = options;
  const shown = legendShown(legend, o) ? legend : undefined;
  const m = marginOf(o);
  const position = shown ? (shown.position ?? "top") : undefined;
  const side =
    shown && (position === "left" || position === "right")
      ? sideWidth(ctx, shown, width - m.left - m.right, lookOf(shown, o))
      : 0;
  const space = shown ? legendSpace(shown, o) : 0;
  const left =
    m.left + yAxisSpace(o, yLabelWidth) + (position === "left" ? side : 0);
  const top = m.top + headerHeight(o) + (position === "top" ? space : 0);
  return {
    left,
    top,
    width: Math.max(
      10,
      width - left - 14 - m.right - (position === "right" ? side : 0),
    ),
    height: Math.max(
      10,
      height -
        top -
        xAxisSpace(o, xLabelWidth) -
        m.bottom -
        (position === "bottom" ? space : 0),
    ),
  };
}

/** 그리지 않은 legend의 metadata. 항목이 없어 화면은 색 버튼을 겹치지 않는다. */
function emptyMeta(legend: LegendInput): LegendMeta {
  return {
    title: legend.title,
    values: legend.values,
    colors: legend.colors,
    box: { x: 0, y: 0, width: 0, height: 0 },
    entries: [],
    hidden: 0,
  };
}

/**
 * framePlot이 비워 둔 자리에 legend를 그린다. framePlot에 넘긴 것과 같은 options를 넘긴다.
 * legend.visible이 꺼져 있으면 그리지 않고 항목이 빈 metadata(box 0, entries [])를 돌려준다.
 */
export function drawLegendAround(
  ctx: Ctx,
  legend: LegendInput,
  plot: Plot,
  yLabelWidth: number,
  options: ChartOptions = DEFAULT_OPTIONS,
): LegendMeta {
  const o = options;
  if (!legendShown(legend, o)) return emptyMeta(legend);
  const look = lookOf(legend, o);
  const m = marginOf(o);
  switch (legend.position ?? "top") {
    case "top":
      return drawLegend(
        ctx,
        legend,
        look,
        plot.left,
        m.top + headerHeight(o) - 4,
        plot.width,
      );
    case "bottom":
      // x축 눈금 글자 아래, PNG 아래 끝에서 legend 자리만큼 위
      return drawLegend(
        ctx,
        legend,
        look,
        plot.left,
        canvasSize(ctx).height - m.bottom - legendSpace(legend, o),
        plot.width,
      );
    case "left": {
      const x = 4 + m.left;
      const width = plot.left - yAxisSpace(o, yLabelWidth) - GAP - m.left;
      return drawVerticalLegend(
        ctx,
        legend,
        look,
        x,
        plot.top,
        width,
        plot.height,
      );
    }
    case "right": {
      const x = plot.left + plot.width + GAP;
      const width = canvasSize(ctx).width - x - 4 - m.right;
      return drawVerticalLegend(
        ctx,
        legend,
        look,
        x,
        plot.top,
        width,
        plot.height,
      );
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

function drawBox(ctx: Ctx, box: Rect, look: Look) {
  ctx.fillStyle = look.surface;
  ctx.strokeStyle = look.borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(box.x + 0.5, box.y + 0.5, box.width, box.height, 4);
  ctx.fill();
  if (look.border) ctx.stroke();
}

function drawMarker(
  ctx: Ctx,
  look: Look,
  cx: number,
  cy: number,
  color: string,
  visible: boolean,
) {
  const r = look.marker;
  // 마커는 데이터 색, 글자는 텍스트 색 (텍스트에 데이터 색을 입히지 않는다)
  ctx.beginPath();
  if (!visible) {
    // 끈 값은 속이 빈 테두리만 그린다.
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = look.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** 세로 legend: 제목 한 줄 아래로 항목을 한 줄씩. 높이를 넘치면 "+N"으로 줄인다. */
function drawVerticalLegend(
  ctx: Ctx,
  legend: LegendInput,
  look: Look,
  x: number,
  y: number,
  width: number,
  maxHeight: number,
): LegendMeta {
  const ROW = look.row;
  const R = look.marker;
  ctx.save();
  ctx.font = `${look.font}px ${THEME.font}`;
  const textWidth = width - PAD * 2;
  const rowsFit = Math.max(0, Math.floor((maxHeight - PAD * 2 - ROW) / ROW));
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
    height: PAD * 2 + ROW * (rows + 1),
  };
  drawBox(ctx, box, look);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = THEME.textMuted;
  ctx.fillText(
    truncate(ctx, legend.title, textWidth),
    x + PAD,
    y + PAD + ROW / 2,
  );
  const entries: LegendMeta["entries"] = [];
  const indexes = order(legend, look).slice(0, shown);
  indexes.forEach((i, row) => {
    const rowY = y + PAD + ROW * (row + 1);
    const midY = rowY + ROW / 2;
    const cx = x + PAD + R;
    const visible = !legend.hidden?.includes(legend.values[i]);
    drawMarker(ctx, look, cx, midY, legend.colors[i], visible);
    ctx.fillStyle = visible ? look.textColor : THEME.textMuted;
    ctx.fillText(
      truncate(ctx, legend.values[i], textWidth - R * 2 - 4),
      cx + R + 4,
      midY,
    );
    entries.push({
      value: legend.values[i],
      color: legend.colors[i],
      index: i,
      rect: { x: x + 2, y: rowY, width: width - 4, height: ROW },
      marker: { x: cx, y: midY },
      visible,
    });
  });
  if (hidden) {
    ctx.fillStyle = THEME.textMuted;
    ctx.fillText(`+${hidden}`, x + PAD, y + PAD + ROW * (shown + 1) + ROW / 2);
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
  look: Look,
  x: number,
  y: number,
  maxWidth: number,
): LegendMeta {
  const R = look.marker;
  const H = look.box;
  ctx.save();
  ctx.font = `${look.font}px ${THEME.font}`;
  const titleText = `${legend.title}`;
  const titleWidth = ctx.measureText(titleText).width;

  // 들어가는 만큼만 항목을 놓고, 넘치면 "+N"으로 줄인다.
  const entries: LegendMeta["entries"] = [];
  let cursor = x + PAD + titleWidth + GAP;
  const moreWidth = ctx.measureText("+8").width + GAP;
  const indexes = order(legend, look);
  for (let k = 0; k < indexes.length; k++) {
    const i = indexes[k];
    const label = legend.values[i];
    const width = R * 2 + 4 + ctx.measureText(label).width;
    const reserve = k < indexes.length - 1 ? moreWidth : 0;
    if (cursor + width + reserve > x + maxWidth - PAD) break;
    entries.push({
      value: label,
      color: legend.colors[i],
      index: i,
      rect: { x: cursor - 2, y, width: width + 4, height: H },
      marker: { x: cursor + R, y: y + H / 2 },
      visible: !legend.hidden?.includes(label),
    });
    cursor += width + GAP;
  }
  const hidden = legend.values.length - entries.length;
  const boxWidth = Math.min(
    maxWidth,
    cursor - x - GAP + PAD + (hidden ? moreWidth : 0),
  );
  const box = { x, y, width: boxWidth, height: H };

  drawBox(ctx, box, look);

  const midY = y + H / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = THEME.textMuted;
  ctx.fillText(titleText, x + PAD, midY);
  for (const entry of entries) {
    const cx = entry.marker.x;
    drawMarker(ctx, look, cx, midY, entry.color, entry.visible);
    ctx.fillStyle = entry.visible ? look.textColor : THEME.textMuted;
    ctx.fillText(entry.value, cx + R + 4, midY);
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
