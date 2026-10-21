// scatter 렌더러. 캔버스에 그리고, 툴팁에 쓸 metadata(축 정보 + 픽셀 기준으로 줄인 점)를 만든다.
// 캔버스 2D 컨텍스트만 있으면 되므로 Worker든 Node(skia-canvas 등)든 그대로 돈다.

import { extent } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { utcFormat } from "d3-time-format";
import {
  drawLegendAround,
  framePlot,
  type LegendInput,
  type LegendMeta,
} from "./legend";
import { drawShapes, type Shape } from "./shapes";
import { THEME } from "./theme";

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

export type AxisKind = "number" | "time";

export type AxisMeta = {
  kind: AxisKind;
  /** 데이터 값 기준 범위 (시계열은 epoch ms) */
  domain: [number, number];
};

export type ScatterMeta = {
  chartType: "scatter";
  /** PNG 안에서 그림 영역의 픽셀 범위 */
  plot: { left: number; top: number; width: number; height: number };
  x: AxisMeta;
  y: AxisMeta;
  /** 같은 픽셀 칸에 겹친 점은 첫 점만 남긴다. px/py는 PNG 좌표, x/y는 데이터 값이다. */
  points: {
    px: number[];
    py: number[];
    x: number[];
    y: number[];
    id: number[];
    /** legend 인덱스 (legend가 있을 때만) */
    g?: number[];
  };
  total: number;
  legend?: LegendMeta;
};

export type ScatterInput = {
  width: number;
  height: number;
  title: string;
  xKind: AxisKind;
  xs: Float64Array;
  ys: Float64Array;
  ids: Float64Array;
  color: string;
  /** legend가 있으면 점마다 legend 인덱스로 색을 고른다. */
  legend?: LegendInput & { index: Uint8Array };
  /** 확대한 범위. 없으면 데이터 전체 범위를 보기 좋게 맞춘다. */
  view?: ItemView;
  shapes: readonly Shape[];
  /** 섬네일: 축·제목·legend 없이 그림 영역만 그린다. */
  compact?: boolean;
};

export type ItemView = { x: [number, number]; y: [number, number] };

export type RenderStage = "aggregate" | "render";
export type ProgressFn = (stage: RenderStage, ratio: number) => void;

type Ctx = OffscreenCanvasRenderingContext2D;

const CHUNK = 50_000;

function niceDomain(values: Float64Array): [number, number] {
  const [min, max] = extent(values) as [number | undefined, number | undefined];
  if (min === undefined || max === undefined) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

function timeFormatter(domain: [number, number]) {
  const span = domain[1] - domain[0];
  const fmt = utcFormat(
    span > 2 * DAY_MS ? "%m/%d" : span > DAY_MS / 4 ? "%m/%d %H시" : "%H:%M",
  );
  // 축은 KST로 읽히게 한다.
  return (v: number) => fmt(new Date(v + KST_OFFSET_MS));
}

/** 섬네일의 그림 영역: 여백만 조금 두고 전부 쓴다. */
export function compactPlot(width: number, height: number) {
  const pad = 4;
  return {
    left: pad,
    top: pad,
    width: Math.max(10, width - pad * 2),
    height: Math.max(10, height - pad * 2),
  };
}

export function renderScatter(
  ctx: Ctx,
  input: ScatterInput,
  progress: ProgressFn,
): ScatterMeta {
  const { width, height, xs, ys } = input;
  const n = xs.length;

  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, width, height);

  // ── 축 범위와 눈금 (aggregate) ─────────────────────────────────
  const { view } = input;
  const xDomain = view?.x ?? niceDomain(xs);
  const yDomain = view?.y ?? niceDomain(ys);
  const y = scaleLinear().domain(yDomain);
  if (!view) y.nice(5);
  const yTicks = y.ticks(5);
  const yFormat = y.tickFormat(5);

  ctx.font = `11px ${THEME.font}`;
  const yLabelWidth = Math.max(
    ...yTicks.map((t) => ctx.measureText(yFormat(t)).width),
    10,
  );
  const plot = input.compact
    ? compactPlot(width, height)
    : framePlot(ctx, width, height, yLabelWidth, input.legend);
  y.range([plot.top + plot.height, plot.top]);

  const x =
    input.xKind === "time"
      ? scaleUtc()
          .domain(xDomain)
          .range([plot.left, plot.left + plot.width])
      : scaleLinear()
          .domain(xDomain)
          .range([plot.left, plot.left + plot.width]);
  if (!view && input.xKind !== "time") x.nice(5);
  const xTicks = x.ticks(Math.max(2, Math.floor(plot.width / 90))) as (
    | number
    | Date
  )[];
  const xFormat =
    input.xKind === "time"
      ? timeFormatter(xDomain)
      : (x as ReturnType<typeof scaleLinear<number>>).tickFormat(5);

  // 픽셀 단위로 점을 줄인다. 툴팁의 "가장 가까운 점"은 이 점들 안에서 찾는다.
  const cell = new Int32Array(plot.width * plot.height).fill(-1);
  const px: number[] = [];
  const py: number[] = [];
  const keptX: number[] = [];
  const keptY: number[] = [];
  const keptId: number[] = [];
  const keptG: number[] = [];
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cx = x(xs[i]) as number;
    const cy = y(ys[i]);
    sx[i] = cx;
    sy[i] = cy;
    const ix = Math.round(cx - plot.left);
    const iy = Math.round(cy - plot.top);
    if (ix >= 0 && iy >= 0 && ix < plot.width && iy < plot.height) {
      const idx = iy * plot.width + ix;
      if (cell[idx] === -1) {
        cell[idx] = i;
        px.push(Math.round(cx));
        py.push(Math.round(cy));
        keptX.push(xs[i]);
        keptY.push(ys[i]);
        keptId.push(input.ids[i]);
        if (input.legend) keptG.push(input.legend.index[i]);
      }
    }
    if (i % CHUNK === 0) progress("aggregate", i / n);
  }
  progress("aggregate", 1);

  // ── 그리드와 축, 제목, legend (섬네일은 그림 영역만 그린다) ───────────
  let legendMeta: LegendMeta | undefined;
  if (!input.compact) {
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = THEME.textSecondary;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of yTicks) {
      const ty = Math.round(y(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(plot.left, ty);
      ctx.lineTo(plot.left + plot.width, ty);
      ctx.stroke();
      ctx.fillText(yFormat(t), plot.left - 6, ty);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of xTicks) {
      const v = +t;
      const tx = Math.round(x(v) as number) + 0.5;
      ctx.fillText(xFormat(v), tx, plot.top + plot.height + 7);
    }
    ctx.strokeStyle = THEME.axis;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top + plot.height + 0.5);
    ctx.lineTo(plot.left + plot.width, plot.top + plot.height + 0.5);
    ctx.stroke();

    // ── 제목 ──────────────────────────────────────────────────────
    ctx.fillStyle = THEME.textPrimary;
    ctx.font = `600 12px ${THEME.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(input.title, plot.left, 17, plot.width);
    ctx.fillStyle = THEME.textMuted;
    ctx.font = `11px ${THEME.font}`;
    ctx.textAlign = "right";
    ctx.fillText(`${n.toLocaleString()} pts`, plot.left + plot.width, 17);

    // ── legend ────────────────────────────────────────────────
    legendMeta = input.legend
      ? drawLegendAround(ctx, input.legend, plot, yLabelWidth)
      : undefined;
  }

  // ── 점 (render) ───────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  if (n === 0) {
    ctx.fillStyle = THEME.textMuted;
    ctx.textAlign = "center";
    ctx.fillText(
      "데이터 없음",
      plot.left + plot.width / 2,
      plot.top + plot.height / 2,
    );
  } else {
    // legend 값마다 한 번씩 훑으며 그 색의 점만 그린다 (fillStyle 전환을 줄인다).
    const { legend } = input;
    const passes = legend ? legend.colors : [input.color];
    // 섬네일은 점이 적어도 테두리 원 대신 작은 점으로 그린다.
    const small = !input.compact && n <= 400;
    const size = input.compact || n > 50_000 ? 1.5 : 2.5;
    const half = size / 2;
    passes.forEach((color, g) => {
      ctx.fillStyle = color;
      if (small) {
        // 점이 적으면 8px 점 + 2px 배경색 테두리로 겹쳐도 구분되게 한다.
        ctx.strokeStyle = THEME.surface;
        ctx.lineWidth = 2;
      } else {
        // 점이 많으면 작은 반투명 점으로 밀도를 보여준다.
        ctx.globalAlpha = n > 100_000 ? 0.25 : n > 10_000 ? 0.4 : 0.6;
      }
      for (let i = 0; i < n; i++) {
        if (legend && legend.index[i] !== g) continue;
        if (small) {
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fill();
        } else {
          ctx.fillRect(sx[i] - half, sy[i] - half, size, size);
        }
        if (i % CHUNK === 0) progress("render", (g + i / n) / passes.length);
      }
    });
  }
  // 도형은 점 위에, 같은 그림 영역 clip 안에 그린다.
  ctx.globalAlpha = 1;
  drawShapes(
    ctx,
    input.shapes,
    (v) => x(v) as number,
    (v) => y(v),
  );
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "scatter",
    plot,
    x: { kind: input.xKind, domain: [+x.domain()[0], +x.domain()[1]] },
    y: { kind: "number", domain: [y.domain()[0], y.domain()[1]] },
    points: {
      px,
      py,
      x: keptX,
      y: keptY,
      id: keptId,
      ...(input.legend ? { g: keptG } : {}),
    },
    total: n,
    legend: legendMeta,
  };
}
