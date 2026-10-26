// 차트 속성(options)을 캔버스에 옮기는 공통 그리기 조각. 렌더러는 이 파일과 axis-style.ts만 보면 된다.
// 모든 함수는 DEFAULT_OPTIONS일 때 지금까지 그리던 모습(글꼴·색·위치)과 똑같이 그린다.
//
// ── 구역별 API ──────────────────────────────────────────────────────
// panel   drawPanel(ctx, w, h, o)                 배경(backColor·gradient)·테두리. fillRect(THEME.surface) 대신
//         surfaceOf(o)                            점 테두리·legend 상자 등 '배경색' 자리에 쓰는 색
//         marginOf(o)                             정수로 맞춘 여백 {top,right,bottom,left}
// title   drawTitle(ctx, plot, title, info, o)    frame.ts. 제목(왼쪽/가운데/오른쪽)·부제목·오른쪽 요약 글자
//         headerHeight(o)                         제목 줄이 차지하는 높이 (기본 28). framePlot이 쓴다
//         titleText(o, label)                     비우면 item label
// size    fontPx(o, base, manual?)                자동이면 base를 [fontMin,fontMax]로, 수동이면 manual(구역의 fontSize)
//         pointSizeOf(o, auto)                    자동이면 auto를 [pointMin,pointMax]로, 수동이면 pointFixed
//         lineWidthOf(o, base)                    lineWidth를 바꾸지 않았으면 차트 기본 굵기(base)
// legend  legendStyleOf(o)                        LegendInput.style에 넣는 값 (글자 크기 자동 반영). job-manager가 넣어 준다
// palette gradientColors(palette, n)              start→(middle)→end 그라데이션 n색. job-manager가 legend 기본 색으로 쓴다
// shape   pathPoint(ctx, shape, x, y, r)          현재 path에 도형 하나를 더한다 (같은 색 점을 한 path로 모아 fill 한 번)
//         drawPoint(ctx, shape, x, y, r, style, borderWidth, fill, stroke)  점 하나를 바로 그린다
//         alphaOf(transparency)                   투명도 → globalAlpha (0이면 불투명)
// label   formatValue(v, decimals)                소수 자리 (null이면 자동, 천 단위 쉼표)
//         createLabelGuard()                      겹치는 점 글자를 건너뛰는 검사기
//         drawPointLabel(ctx, x, y, value, o.pointLabel, fontPx, guard?)  점 글자. 겹치면 그리지 않고 null
// axes    axis-style.ts (따로 import): valueScale, numberFormat, timeFormat, yAxisSpace, xAxisSpace,
//         drawYAxis, drawXAxis, drawAxisTitles. 범주 축 글자·기준선은 frame.ts의 drawCategoryLabels·drawBaseline

import {
  type ChartOptions,
  DEFAULT_OPTIONS,
  type LegendStyle,
  type PaletteOptions,
  type PointLabelOptions,
  type PointShape,
  type ShapeOptions,
} from "./options";
import { THEME } from "./theme";

type Ctx = OffscreenCanvasRenderingContext2D;
export type Rect = { x: number; y: number; width: number; height: number };

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

// ── 색 ──────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]: number[]) {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** a와 b를 t(0..1) 비율로 섞는다. */
export function mixColor(a: string, b: string, t: number) {
  const ca = rgb(a);
  const cb = rgb(b);
  return hex(ca.map((c, i) => c + (cb[i] - c) * t));
}

// ── panel ───────────────────────────────────────────────────────

export function marginOf(o: ChartOptions = DEFAULT_OPTIONS) {
  const m = o.panel.margin;
  return {
    top: Math.round(m.top),
    right: Math.round(m.right),
    bottom: Math.round(m.bottom),
    left: Math.round(m.left),
  };
}

/** 배경색 자리(점 테두리, legend 상자 속)에 쓰는 색 */
export function surfaceOf(o: ChartOptions = DEFAULT_OPTIONS) {
  return o.panel.backColor;
}

/** PNG 전체 배경. gradient면 위는 밝게, 아래는 조금 어둡게. border면 여백 안쪽 테두리 */
export function drawPanel(
  ctx: Ctx,
  width: number,
  height: number,
  o: ChartOptions = DEFAULT_OPTIONS,
) {
  const { panel } = o;
  if (panel.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, mixColor(panel.backColor, "#ffffff", 0.6));
    g.addColorStop(1, mixColor(panel.backColor, "#000000", 0.08));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = panel.backColor;
  }
  ctx.fillRect(0, 0, width, height);
  if (panel.border) {
    const m = marginOf(o);
    ctx.save();
    ctx.strokeStyle = panel.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      m.left + 0.5,
      m.top + 0.5,
      Math.max(0, width - m.left - m.right - 1),
      Math.max(0, height - m.top - m.bottom - 1),
    );
    ctx.restore();
  }
}

// ── size ────────────────────────────────────────────────────────

/** 글자 크기. 자동이면 차트가 정한 base를 [fontMin, fontMax]로, 수동이면 구역의 fontSize(manual) */
export function fontPx(
  o: ChartOptions = DEFAULT_OPTIONS,
  base: number,
  manual: number = base,
) {
  const { size } = o;
  return size.fontAuto
    ? clamp(base, Math.min(size.fontMin, size.fontMax), size.fontMax)
    : manual;
}

/** 점 크기. 자동이면 차트가 정한 auto를 [pointMin, pointMax]로, 수동이면 pointFixed */
export function pointSizeOf(o: ChartOptions = DEFAULT_OPTIONS, auto: number) {
  const { size } = o;
  return size.pointAuto
    ? clamp(auto, Math.min(size.pointMin, size.pointMax), size.pointMax)
    : size.pointFixed;
}

/** 선 굵기. 기본값에서 바꾸지 않았으면 차트가 원래 쓰던 굵기(base) */
export function lineWidthOf(o: ChartOptions = DEFAULT_OPTIONS, base: number) {
  return o.size.lineWidth === DEFAULT_OPTIONS.size.lineWidth
    ? base
    : o.size.lineWidth;
}

// ── title ───────────────────────────────────────────────────────

export function titleText(o: ChartOptions = DEFAULT_OPTIONS, label: string) {
  return o.title.text.trim() || label;
}

export function titleFont(o: ChartOptions = DEFAULT_OPTIONS) {
  return fontPx(o, 12, o.title.fontSize);
}

export function subtitleFont(o: ChartOptions = DEFAULT_OPTIONS) {
  return Math.max(8, Math.round(titleFont(o) * 0.9));
}

/** 제목 글자의 baseline (여백 포함). 기본 17 */
export function titleBaseline(o: ChartOptions = DEFAULT_OPTIONS) {
  return marginOf(o).top + 5 + titleFont(o);
}

/**
 * 제목 줄(제목 + 부제목)이 위에서 차지하는 높이. 여백은 뺀 값이고 기본 28이다.
 * 제목을 숨기면 요약 글자도 그리지 않고 8만 남긴다.
 */
export function headerHeight(o: ChartOptions = DEFAULT_OPTIONS) {
  if (!o.title.visible) return 8;
  const sub = o.title.subtitle.trim() ? subtitleFont(o) + 4 : 0;
  return Math.ceil(5 + titleFont(o) + 11 + sub);
}

// ── legend ──────────────────────────────────────────────────────

/** LegendInput.style에 넣는 legend 모양. 글자 크기는 size.fontAuto를 반영한 값이다. */
export function legendStyleOf(o: ChartOptions = DEFAULT_OPTIONS): LegendStyle {
  return { ...o.legend, fontSize: fontPx(o, 11, o.legend.fontSize) };
}

// ── palette ─────────────────────────────────────────────────────

/**
 * 그라데이션 색 n개. steps(0이면 n)단계로 start→(middle)→end를 나누고, n이 단계보다 많으면
 * 값 순서를 단계에 고르게 나눠 같은 단계 색을 함께 쓴다.
 */
export function gradientColors(palette: PaletteOptions, n: number): string[] {
  if (n <= 0) return [];
  const stops = [palette.start, palette.middle, palette.end].filter(Boolean);
  if (palette.reverse) stops.reverse();
  const steps = Math.max(1, Math.round(palette.steps) || n);
  const at = (t: number) => {
    const seg = (stops.length - 1) * t;
    const i = Math.min(stops.length - 2, Math.floor(seg));
    return mixColor(stops[i], stops[i + 1], seg - i);
  };
  const grades = Array.from({ length: steps }, (_, k) =>
    at(steps === 1 ? 0 : k / (steps - 1)),
  );
  return Array.from(
    { length: n },
    (_, i) => grades[Math.min(steps - 1, Math.floor((i * steps) / n))],
  );
}

// ── shape ───────────────────────────────────────────────────────

/** 투명도(0..1)를 globalAlpha로. 0(기본값)이면 모든 차트에서 불투명이다. */
export function alphaOf(transparency: number) {
  return clamp(1 - transparency, 0, 1);
}

/**
 * 현재 path에 도형 하나를 더한다 (beginPath는 부르는 쪽이). 같은 색 점 수만 개를 한 path에 모아
 * fill/stroke를 한 번만 부르면 빠르다. cross는 넓이가 없어 stroke로만 보인다.
 */
export function pathPoint(
  ctx: Ctx,
  shape: PointShape,
  x: number,
  y: number,
  r: number,
) {
  switch (shape) {
    case "circle":
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      return;
    case "square":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      return;
    case "triangle":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.866, y + r * 0.5);
      ctx.lineTo(x - r * 0.866, y + r * 0.5);
      ctx.closePath();
      return;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      return;
    case "cross":
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      return;
  }
}

/**
 * 점 하나. style both: 채우기(fill) + 테두리(stroke, borderWidth), border: fill 색 테두리만,
 * brush: 채우기만. cross는 언제나 fill 색 선으로 그린다.
 */
export function drawPoint(
  ctx: Ctx,
  shape: PointShape,
  x: number,
  y: number,
  r: number,
  style: ShapeOptions["style"],
  borderWidth: number,
  fill: string,
  stroke: string,
) {
  ctx.beginPath();
  pathPoint(ctx, shape, x, y, r);
  if (shape === "cross") {
    ctx.strokeStyle = fill;
    ctx.lineWidth = Math.max(1, borderWidth || r / 2);
    ctx.stroke();
    return;
  }
  if (style !== "border") {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (style === "border") {
    ctx.strokeStyle = fill;
    ctx.lineWidth = Math.max(1, borderWidth);
    ctx.stroke();
  } else if (style === "both" && borderWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }
}

// ── point label ─────────────────────────────────────────────────

const formatters = new Map<string, Intl.NumberFormat>();

/** 점 글자·축 눈금 숫자. decimals가 null이면 크기에 맞춰 자동(최대 2자리, 끝 0 생략) */
export function formatValue(v: number, decimals: number | null) {
  if (!Number.isFinite(v)) return String(v);
  const key = decimals === null ? "auto" : String(decimals);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 2,
    });
    formatters.set(key, f);
  }
  return f.format(v);
}

const CELL = 32;

/** 이미 그린 점 글자 상자와 겹치는지 검사한다. 칸(32px) 단위로 나눠 둬 점이 많아도 빠르다. */
export function createLabelGuard() {
  const cells = new Map<string, Rect[]>();
  const keys = (r: Rect) => {
    const out: string[] = [];
    for (
      let cx = Math.floor(r.x / CELL);
      cx <= Math.floor((r.x + r.width) / CELL);
      cx++
    )
      for (
        let cy = Math.floor(r.y / CELL);
        cy <= Math.floor((r.y + r.height) / CELL);
        cy++
      )
        out.push(`${cx},${cy}`);
    return out;
  };
  const hit = (a: Rect, b: Rect) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
  return {
    /** 겹치지 않으면 자리를 잡고 true */
    take(r: Rect) {
      const ks = keys(r);
      if (ks.some((k) => cells.get(k)?.some((o) => hit(o, r)))) return false;
      for (const k of ks) {
        const list = cells.get(k);
        if (list) list.push(r);
        else cells.set(k, [r]);
      }
      return true;
    },
  };
}
export type LabelGuard = ReturnType<typeof createLabelGuard>;

/** 점 글자 상자 (회전 전 기준). 겹침 검사와 그리기가 같은 값을 쓴다. */
export function pointLabelRect(
  ctx: Ctx,
  x: number,
  y: number,
  text: string,
  position: PointLabelOptions["position"],
  font: number,
): Rect {
  const w = ctx.measureText(text).width + 6;
  const h = font + 4;
  const gap = 4;
  const top =
    position === "top"
      ? y - gap - h
      : position === "bottom"
        ? y + gap
        : y - h / 2;
  return { x: x - w / 2, y: top, width: w, height: h };
}

/**
 * 점 글자 하나. value가 숫자면 prefix + formatValue + suffix. guard가 있으면 겹칠 때 그리지 않고 null.
 * 그린 상자(회전 전)를 돌려준다.
 */
export function drawPointLabel(
  ctx: Ctx,
  x: number,
  y: number,
  value: number | string,
  o: PointLabelOptions,
  font: number,
  guard?: LabelGuard,
): Rect | null {
  const body =
    typeof value === "number" ? formatValue(value, o.decimals) : value;
  const text = `${o.prefix}${body}${o.suffix}`;
  ctx.save();
  ctx.font = `${font}px ${THEME.font}`;
  const rect = pointLabelRect(ctx, x, y, text, o.position, font);
  if (guard && !guard.take(rect)) {
    ctx.restore();
    return null;
  }
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.translate(cx, cy);
  if (o.angle) ctx.rotate((-o.angle * Math.PI) / 180);
  if (o.box.visible) {
    ctx.fillStyle = o.box.background;
    ctx.strokeStyle = o.box.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = o.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return rect;
}
