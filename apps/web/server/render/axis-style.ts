// 축 속성(options.axes)을 옮기는 그리기 조각. 값 축 범위(min·max·log), 눈금 개수·형식,
// 축 선·그리드·눈금 선·눈금 글자·축 제목. 기본값이면 지금까지의 scatter·bar 축과 똑같이 그린다.
//
// valueScale(domain, range, axis, { nice, zoomed })  → { scale, ticks, format, log }
// numberFormat(decimals, fallback) / timeFormat(dateFormat, domain)
// yAxisSpace(o, yLabelWidth) / xAxisSpace(o, xLabelWidth)  그림 영역 왼쪽·아래에 남기는 폭 (framePlot이 쓴다)
// drawYAxis(ctx, plot, y, ticks, format, o)   가로 그리드 + 왼쪽 눈금 글자·눈금 선·축 선
// drawXAxis(ctx, plot, x, ticks, format, o)   아래 축 선 + 세로 그리드·눈금 선·눈금 글자
// drawAxisTitles(ctx, plot, o, titles, yLabelWidth)  축 제목 (title.visible일 때만)

import { scaleLinear, scaleLog } from "d3-scale";
import { utcFormat } from "d3-time-format";
import {
  type AxisOptions,
  type ChartOptions,
  DEFAULT_OPTIONS,
} from "./options";
import { fontPx, formatValue } from "./style";
import { THEME } from "./theme";

type Ctx = OffscreenCanvasRenderingContext2D;
type Plot = { left: number; top: number; width: number; height: number };
type Scale = (v: number) => number;

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
/** 회전한 x 눈금 글자의 폭을 모를 때 쓰는 값 */
const DEFAULT_X_LABEL_WIDTH = 60;

export type ValueScale = {
  scale: ((v: number) => number) & {
    domain(): number[];
    range(): number[];
    invert(v: number): number;
  };
  ticks: number[];
  format: (v: number) => string;
  /** 실제로 로그 축을 썼는지 (log를 켜도 0 이하 값이 있으면 선형) */
  log: boolean;
};

/** 숫자 눈금 형식. decimals가 null이면 차트가 정한 형식(fallback) */
export function numberFormat(
  decimals: number | null,
  fallback: (v: number) => string,
) {
  return decimals === null ? fallback : (v: number) => formatValue(v, decimals);
}

/** 보이는 범위가 좁을수록 초·밀리초까지 적는 자동 시계열 형식 (scatter와 같다) */
export function autoTimeFormat(domain: [number, number]) {
  const span = domain[1] - domain[0];
  return span > 2 * DAY_MS
    ? "%m/%d"
    : span > DAY_MS / 4
      ? "%m/%d %H시"
      : span > 10 * 60_000
        ? "%H:%M"
        : span > 5_000
          ? "%H:%M:%S"
          : "%H:%M:%S.%L";
}

/** 시계열 눈금 형식(KST). dateFormat이 비면 범위에 맞춘 자동 형식 */
export function timeFormat(dateFormat: string, domain: [number, number]) {
  const fmt = utcFormat(dateFormat.trim() || autoTimeFormat(domain));
  return (v: number) => fmt(new Date(v + KST_OFFSET_MS));
}

/**
 * 값 축. min·max가 있으면 그 값으로 고정하고(확대 중이면 확대 범위가 이긴다), 둘 다 없을 때만 nice를 건다.
 * log는 범위가 모두 양수일 때만 쓰고, 아니면 선형으로 돌아간다.
 */
export function valueScale(
  domain: [number, number],
  range: [number, number],
  axis: AxisOptions = DEFAULT_OPTIONS.axes.y,
  { nice = true, zoomed = false }: { nice?: boolean; zoomed?: boolean } = {},
): ValueScale {
  let d: [number, number] = zoomed
    ? domain
    : [axis.min ?? domain[0], axis.max ?? domain[1]];
  if (!(d[0] < d[1])) d = domain;
  const fixed = !zoomed && (axis.min !== null || axis.max !== null);
  const count = Math.max(1, Math.round(axis.tick.count));
  if (axis.log && d[0] > 0 && d[1] > 0) {
    const scale = scaleLog().domain(d).range(range);
    if (nice && !fixed && !zoomed) scale.nice();
    let ticks = scale.ticks(count);
    // 로그 눈금은 10배마다 1..9를 모두 주므로 많으면 10의 거듭제곱만 남긴다.
    if (ticks.length > count * 2) {
      const powers = ticks.filter(
        (t) => Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9,
      );
      if (powers.length >= 2) ticks = powers;
    }
    return {
      scale,
      ticks,
      format: numberFormat(axis.decimals, (v) => formatValue(v, null)),
      log: true,
    };
  }
  const scale = scaleLinear().domain(d).range(range);
  if (nice && !fixed && !zoomed) scale.nice(count);
  return {
    scale,
    ticks: scale.ticks(count),
    format: numberFormat(axis.decimals, scale.tickFormat(count)),
    log: false,
  };
}

function labelFont(o: ChartOptions, axis: AxisOptions) {
  return fontPx(o, 11, axis.label.fontSize);
}

function tickLength(axis: AxisOptions) {
  return axis.tick.visible ? Math.max(0, Math.round(axis.tick.length)) : 0;
}

/**
 * 그림 영역 왼쪽에 남기는 폭: 눈금 글자(yLabelWidth) + 14 + 눈금 선 + 축 제목. 기본은 ceil(yLabelWidth) + 14.
 * 축이나 눈금 글자를 숨기면 글자 폭을 빼고, y 제목을 켜면 글자 한 줄을 더한다.
 */
export function yAxisSpace(o: ChartOptions = DEFAULT_OPTIONS, yLabelWidth = 0) {
  const y = o.axes.y;
  if (!y.visible) return 14;
  const labels = y.label.visible ? Math.ceil(yLabelWidth) : 0;
  const title = y.title.visible ? labelFont(o, y) + 6 : 0;
  // 그림 영역은 정수 픽셀이어야 한다 (scatter metadata가 픽셀 칸 번호로 점을 찾는다).
  return Math.ceil(labels + 14 + tickLength(y) + title);
}

/**
 * 그림 영역 아래에 남기는 높이: 7 + 눈금 글자(회전하면 sin·cos로) + 8 + 축 제목. 기본 26.
 * xLabelWidth는 회전한 글자 중 가장 긴 폭 (모르면 60).
 */
export function xAxisSpace(
  o: ChartOptions = DEFAULT_OPTIONS,
  xLabelWidth = DEFAULT_X_LABEL_WIDTH,
) {
  const x = o.axes.x;
  if (!x.visible) return 8;
  const fs = labelFont(o, x);
  const rad = (x.label.angle * Math.PI) / 180;
  const labels = x.label.visible
    ? 7 +
      Math.ceil(
        Math.abs(Math.sin(rad)) * xLabelWidth + Math.abs(Math.cos(rad)) * fs,
      ) +
      8
    : 8;
  const title = x.title.visible ? fs + 6 : 0;
  return Math.ceil(labels + tickLength(x) + title);
}

/** 가로 그리드 선 + 왼쪽 눈금 글자·눈금 선 + 왼쪽 축 선 */
export function drawYAxis(
  ctx: Ctx,
  plot: Plot,
  y: Scale,
  ticks: readonly number[],
  format: (v: number) => string,
  o: ChartOptions = DEFAULT_OPTIONS,
) {
  const axis = o.axes.y;
  ctx.save();
  if (axis.grid.visible) {
    ctx.strokeStyle = axis.grid.color;
    ctx.lineWidth = axis.grid.width;
    ctx.beginPath();
    for (const t of ticks) {
      const ty = Math.round(y(t)) + 0.5;
      ctx.moveTo(plot.left, ty);
      ctx.lineTo(plot.left + plot.width, ty);
    }
    ctx.stroke();
  }
  if (!axis.visible) {
    ctx.restore();
    return;
  }
  const len = tickLength(axis);
  if (len > 0) {
    ctx.strokeStyle = axis.tick.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of ticks) {
      const ty = Math.round(y(t)) + 0.5;
      ctx.moveTo(plot.left - len, ty);
      ctx.lineTo(plot.left, ty);
    }
    ctx.stroke();
  }
  if (axis.label.visible) {
    ctx.font = `${labelFont(o, axis)}px ${THEME.font}`;
    ctx.fillStyle = axis.label.color;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const rad = (-axis.label.angle * Math.PI) / 180;
    for (const t of ticks) {
      const tx = plot.left - 6 - len;
      const ty = Math.round(y(t)) + 0.5;
      if (rad) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(rad);
        ctx.fillText(format(t), 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(format(t), tx, ty);
      }
    }
  }
  if (axis.line.visible) {
    ctx.strokeStyle = axis.line.color;
    ctx.lineWidth = axis.line.width;
    ctx.beginPath();
    ctx.moveTo(plot.left + 0.5, plot.top);
    ctx.lineTo(plot.left + 0.5, plot.top + plot.height);
    ctx.stroke();
  }
  ctx.restore();
}

/** 세로 그리드 선 + 아래 축 선 + 눈금 선 + 아래 눈금 글자 */
export function drawXAxis(
  ctx: Ctx,
  plot: Plot,
  x: Scale,
  ticks: readonly number[],
  format: (v: number) => string,
  o: ChartOptions = DEFAULT_OPTIONS,
) {
  const axis = o.axes.x;
  const bottom = plot.top + plot.height;
  ctx.save();
  if (axis.grid.visible) {
    ctx.strokeStyle = axis.grid.color;
    ctx.lineWidth = axis.grid.width;
    ctx.beginPath();
    for (const t of ticks) {
      const tx = Math.round(x(t)) + 0.5;
      ctx.moveTo(tx, plot.top);
      ctx.lineTo(tx, bottom);
    }
    ctx.stroke();
  }
  if (!axis.visible) {
    ctx.restore();
    return;
  }
  const len = tickLength(axis);
  if (axis.label.visible) {
    ctx.font = `${labelFont(o, axis)}px ${THEME.font}`;
    ctx.fillStyle = axis.label.color;
    const rad = (-axis.label.angle * Math.PI) / 180;
    for (const t of ticks) {
      const tx = Math.round(x(t)) + 0.5;
      const ty = bottom + 7 + len;
      if (rad) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(rad);
        ctx.textAlign = axis.label.angle > 0 ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillText(format(t), 0, 0);
        ctx.restore();
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(format(t), tx, ty);
      }
    }
  }
  if (len > 0) {
    ctx.strokeStyle = axis.tick.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of ticks) {
      const tx = Math.round(x(t)) + 0.5;
      ctx.moveTo(tx, bottom);
      ctx.lineTo(tx, bottom + len);
    }
    ctx.stroke();
  }
  if (axis.line.visible) {
    ctx.strokeStyle = axis.line.color;
    ctx.lineWidth = axis.line.width;
    ctx.beginPath();
    ctx.moveTo(plot.left, bottom + 0.5);
    ctx.lineTo(plot.left + plot.width, bottom + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 축 제목. title.visible인 축만 그린다. 글자가 비면 titles로 받은 이름(보통 컬럼 라벨)을 쓴다.
 * 자리는 yAxisSpace·xAxisSpace가 남긴 바깥쪽 한 줄이다.
 */
export function drawAxisTitles(
  ctx: Ctx,
  plot: Plot,
  o: ChartOptions = DEFAULT_OPTIONS,
  titles: { x?: string; y?: string },
  yLabelWidth = 0,
  xLabelWidth = DEFAULT_X_LABEL_WIDTH,
) {
  const { x, y } = o.axes;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (y.visible && y.title.visible) {
    const fs = labelFont(o, y);
    const text = y.title.text.trim() || titles.y || "";
    const cx = plot.left - yAxisSpace(o, yLabelWidth) + (fs + 6) / 2;
    ctx.save();
    ctx.font = `600 ${fs}px ${THEME.font}`;
    ctx.fillStyle = y.title.color || y.label.color;
    ctx.translate(cx, plot.top + plot.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(text, 0, 0, plot.height);
    ctx.restore();
  }
  if (x.visible && x.title.visible) {
    const fs = labelFont(o, x);
    const text = x.title.text.trim() || titles.x || "";
    const cy =
      plot.top + plot.height + xAxisSpace(o, xLabelWidth) - (fs + 6) / 2;
    ctx.font = `600 ${fs}px ${THEME.font}`;
    ctx.fillStyle = x.title.color || x.label.color;
    ctx.fillText(text, plot.left + plot.width / 2, cy, plot.width);
  }
  ctx.restore();
}
