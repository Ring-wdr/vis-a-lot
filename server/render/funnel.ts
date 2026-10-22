// funnel 렌더러. 단계(값 큰 순으로 줄 세운 범주)를 위에서 아래로 가운데 맞춘 막대로 그리고,
// 이웃 막대를 사다리꼴로 이어 그 사이에 이전 단계 대비 전환율을 적는다.
// 이동·확대가 없으므로 좌표는 그림 영역 픽셀과 1:1인 고정 공간이다:
// x = 그림 영역 왼쪽에서의 거리, y = 그림 영역 아래에서의 거리. 선택·도형도 이 공간에서 판정한다.

import { AGG_LABELS, type AggFn } from "../data/schema";
import { drawTitle, labelWidth, type Plot, truncate } from "./frame";
import {
  drawLegendAround,
  framePlot,
  hiddenIndexes,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { type ChartOptions, optionsOf } from "./options";
import { drawSelection, type Region, regionTester } from "./region";
import { type AxisMeta, compactPlot, type ProgressFn } from "./scatter";
import { drawShapes, type Shape } from "./shapes";
import { alphaOf, drawPanel, fontPx, mixColor, surfaceOf } from "./style";
import { THEME } from "./theme";

type Rect = { x: number; y: number; width: number; height: number };

export type FunnelStage = {
  label: string;
  value: number;
  /** legend 인덱스 (단계 순서) */
  index: number;
  /** 막대의 PNG 좌표 */
  rect: Rect;
  /** 바로 위(보이는) 단계 대비 비율. 첫 단계거나 위 단계 값이 0 이하면 null */
  rate: number | null;
  /** 첫 (보이는) 단계 대비 비율 */
  share: number | null;
};

export type FunnelMeta = {
  chartType: "funnel";
  plot: { left: number; top: number; width: number; height: number };
  /** 고정 좌표: [0, 그림 영역 폭] */
  x: AxisMeta;
  /** 고정 좌표: [0, 그림 영역 높이] (아래에서 위로) */
  y: AxisMeta;
  /** 그린(끄지 않은) 단계만, 위에서 아래 순서 */
  stages: FunnelStage[];
  agg?: AggFn;
  selected?: number;
  legend?: LegendMeta;
};

export type FunnelInput = {
  /** 차트 속성. 없으면 기본값 (optionsOf) */
  options?: ChartOptions;
  width: number;
  height: number;
  title: string;
  /** 위에서 아래 순서의 단계 이름 */
  stages: string[];
  values: (number | null)[];
  agg?: AggFn;
  color: string;
  /** 단계별 색. values는 stages와 같다. */
  legend?: LegendInput;
  shapes: readonly Shape[];
  selection?: Region;
  compact?: boolean;
};

type Ctx = OffscreenCanvasRenderingContext2D;

/** 줄 높이 중 막대가 차지하는 비율. 나머지는 사다리꼴과 전환율 글자 자리다. */
const BAR_RATIO = 0.62;
const MAX_BAR_HEIGHT = 44;
/** 단계 이름 칸 폭의 상한 (PNG 폭 대비) */
const LABEL_MAX_RATIO = 0.28;
/** 글자 한 줄을 적을 최소 높이(px) */
const MIN_TEXT_HEIGHT = 12;

/**
 * 보이는 단계의 막대 자리와 비율. 막대 폭은 가장 큰 값에 대한 비율이고, 가운데 맞춘다.
 * hidden[i]가 true인 단계는 빼고 남은 단계끼리 줄과 비율을 다시 정한다.
 */
export function funnelLayout(
  plot: Plot,
  labels: readonly string[],
  values: readonly (number | null)[],
  hidden: readonly boolean[] = [],
): FunnelStage[] {
  const shown = labels
    .map((label, index) => ({ label, index, value: values[index] ?? 0 }))
    .filter((s) => !hidden[s.index]);
  const max = Math.max(0, ...shown.map((s) => s.value));
  const row = plot.height / Math.max(1, shown.length);
  const barHeight = Math.min(MAX_BAR_HEIGHT, row * BAR_RATIO);
  const center = plot.left + plot.width / 2;
  const first = shown[0]?.value ?? 0;
  return shown.map((s, i) => {
    const width =
      max > 0 ? Math.max(2, (Math.max(0, s.value) / max) * plot.width) : 2;
    const prev = shown[i - 1]?.value;
    return {
      label: s.label,
      value: s.value,
      index: s.index,
      rect: {
        x: center - width / 2,
        y: plot.top + row * i + (row - barHeight) / 2,
        width,
        height: barHeight,
      },
      rate: prev !== undefined && prev > 0 ? s.value / prev : null,
      share: first > 0 ? s.value / first : null,
    };
  });
}

/** 단계 막대를 대표하는 고정 좌표: 막대 가운데 */
export function stageCenter(plot: Plot, rect: Rect): [number, number] {
  return [
    rect.x + rect.width / 2 - plot.left,
    plot.top + plot.height - (rect.y + rect.height / 2),
  ];
}

const percent = (r: number) =>
  `${(r * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const number = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function renderFunnel(
  ctx: Ctx,
  input: FunnelInput,
  progress: ProgressFn,
): FunnelMeta {
  const { width, height } = input;
  const o = optionsOf(input);
  const { shape } = o;
  const off = hiddenIndexes(input.legend);
  const colorOf = (index: number) => input.legend?.colors[index] ?? input.color;
  // 값이 없는 단계: value.nullNumeric을 정했으면 그 값으로 그린다 (없으면 0).
  const { nullNumeric } = o.value;
  const values =
    nullNumeric === null
      ? input.values
      : input.values.map((v) => v ?? nullNumeric);
  const font = fontPx(o, 11);

  drawPanel(ctx, width, height, o);
  // 단계 이름은 y축 눈금 글자 자리(왼쪽)에 적는다.
  const nameWidth = Math.min(
    width * LABEL_MAX_RATIO,
    labelWidth(ctx, input.stages, font),
  );
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, nameWidth, input.legend, o);
  const stages = funnelLayout(plot, input.stages, values, off);
  const x = (v: number) => plot.left + v;
  const y = (v: number) => plot.top + plot.height - v;
  const inSelection = input.selection && regionTester(input.selection);
  const isSelected = (s: FunnelStage) =>
    !inSelection || inSelection(...stageCenter(plot, s.rect));
  const selectedCount = inSelection
    ? stages.filter((s) => isSelected(s)).length
    : 0;
  progress("aggregate", 1);

  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    drawTitle(
      ctx,
      plot,
      input.title,
      [
        input.agg && AGG_LABELS[input.agg],
        `${input.stages.length}개 단계`,
        inSelection && `${selectedCount}개 선택`,
      ],
      o,
    );
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, nameWidth, o)
      : undefined;
  }

  // ── 사다리꼴과 막대 (render) ─────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, plot.top, width, plot.height);
  ctx.clip();
  stages.forEach((s, i) => {
    const next = stages[i + 1];
    if (!next) return;
    const a = s.rect;
    const b = next.rect;
    ctx.fillStyle = THEME.grid;
    ctx.globalAlpha = isSelected(s) && isSelected(next) ? 0.7 : 0.25;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + a.height);
    ctx.lineTo(a.x + a.width, a.y + a.height);
    ctx.lineTo(b.x + b.width, b.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.font = `${font}px ${THEME.font}`;
  ctx.textBaseline = "middle";
  const opacity = alphaOf(shape.transparency, 1);
  const surface = surfaceOf(o);
  const rowPitch = plot.height / Math.max(1, stages.length);
  stages.forEach((s, i) => {
    const { rect } = s;
    const alpha = isSelected(s) ? 1 : 0.2;
    const color = colorOf(s.index);
    // shape: brush는 채우기만, border는 막대 색 테두리만, both는 채우기 + 진한 색 테두리(borderWidth)
    ctx.globalAlpha = alpha * opacity;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 3);
    if (shape.style !== "border") {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (shape.style === "border" || shape.borderWidth > 0) {
      ctx.strokeStyle =
        shape.style === "border" ? color : mixColor(color, "#000000", 0.3);
      ctx.lineWidth = Math.max(1, shape.borderWidth);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (input.compact) return;
    const midY = rect.y + rect.height / 2;
    // 글자가 들어갈 높이가 없으면 생략한다 (툴팁으로 본다).
    // 단계 이름: 왼쪽 칸에 오른쪽 맞춤. 줄 간격이 글자보다 넓을 때만
    if (rowPitch >= Math.max(MIN_TEXT_HEIGHT, font + 1)) {
      ctx.fillStyle = THEME.textSecondary;
      ctx.textAlign = "right";
      ctx.fillText(truncate(ctx, s.label, nameWidth), plot.left - 6, midY);
    }
    // 값과 첫 단계 대비 비율: 막대 안에 들어가면 안에, 아니면 오른쪽에
    const text = `${number(s.value)}${s.share !== null && i > 0 ? ` · ${percent(s.share)}` : ""}`;
    const textWidth = ctx.measureText(text).width;
    if (rect.height >= MIN_TEXT_HEIGHT) {
      // 선택 바깥 막대의 글자도 막대와 함께 흐리게
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      if (textWidth + 8 <= rect.width) {
        // 테두리만 그린 막대 안은 배경이 비치므로 진한 글자
        ctx.fillStyle = shape.style === "border" ? THEME.textPrimary : surface;
        ctx.fillText(text, rect.x + rect.width / 2, midY);
      } else {
        ctx.fillStyle = THEME.textPrimary;
        ctx.textAlign = "left";
        ctx.fillText(text, rect.x + rect.width + 6, midY);
      }
      ctx.globalAlpha = 1;
    }
    // 이전 단계 대비 전환율: 위 막대와의 사이
    const prev = stages[i - 1];
    if (
      prev &&
      s.rate !== null &&
      rect.y - (prev.rect.y + prev.rect.height) >= MIN_TEXT_HEIGHT
    ) {
      ctx.fillStyle = THEME.textMuted;
      ctx.textAlign = "center";
      ctx.fillText(
        `전환 ${percent(s.rate)}`,
        plot.left + plot.width / 2,
        (prev.rect.y + prev.rect.height + rect.y) / 2,
      );
    }
  });
  if (stages.length === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  }
  if (input.selection) {
    drawSelection(ctx, input.selection, x, y, THEME.selection);
  }
  drawShapes(ctx, input.shapes, x, y);
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "funnel",
    plot,
    x: { kind: "number", domain: [0, plot.width] },
    y: { kind: "number", domain: [0, plot.height] },
    stages,
    agg: input.agg,
    ...(inSelection ? { selected: selectedCount } : {}),
    legend: legendMeta,
  };
}
