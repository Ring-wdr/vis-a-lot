// scatter 렌더러. 캔버스에 그리고, 툴팁에 쓸 metadata(축 정보 + 픽셀 기준으로 줄인 점)를 만든다.
// 캔버스 2D 컨텍스트만 있으면 되므로 Worker든 Node(skia-canvas 등)든 그대로 돈다.

import { extent } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { utcFormat } from "d3-time-format";
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
  };
  total: number;
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
};

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
  const xDomain = niceDomain(xs);
  const yDomain = niceDomain(ys);
  const y = scaleLinear().domain(yDomain).nice(5);
  const yTicks = y.ticks(5);
  const yFormat = y.tickFormat(5);

  ctx.font = `11px ${THEME.font}`;
  const yLabelWidth = Math.max(
    ...yTicks.map((t) => ctx.measureText(yFormat(t)).width),
    10,
  );
  const plot = {
    left: Math.ceil(yLabelWidth + 14),
    top: 28,
    width: 0,
    height: 0,
  };
  plot.width = Math.max(10, width - plot.left - 14);
  plot.height = Math.max(10, height - plot.top - 26);
  y.range([plot.top + plot.height, plot.top]);

  const x =
    input.xKind === "time"
      ? scaleUtc()
          .domain(xDomain)
          .range([plot.left, plot.left + plot.width])
      : scaleLinear()
          .domain(xDomain)
          .nice(5)
          .range([plot.left, plot.left + plot.width]);
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
      }
    }
    if (i % CHUNK === 0) progress("aggregate", i / n);
  }
  progress("aggregate", 1);

  // ── 그리드와 축 ───────────────────────────────────────────────
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
  } else if (n <= 400) {
    // 점이 적으면 8px 점 + 2px 배경색 테두리로 겹쳐도 구분되게 한다.
    ctx.fillStyle = input.color;
    ctx.strokeStyle = THEME.surface;
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(sx[i], sy[i], 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
  } else {
    // 점이 많으면 작은 반투명 점으로 밀도를 보여준다.
    const size = n > 50_000 ? 1.5 : 2.5;
    ctx.fillStyle = input.color;
    ctx.globalAlpha = n > 100_000 ? 0.25 : n > 10_000 ? 0.4 : 0.6;
    const half = size / 2;
    for (let i = 0; i < n; i++) {
      ctx.fillRect(sx[i] - half, sy[i] - half, size, size);
      if (i % CHUNK === 0) progress("render", i / n);
    }
  }
  ctx.restore();
  progress("render", 1);

  return {
    chartType: "scatter",
    plot,
    x: { kind: input.xKind, domain: [+x.domain()[0], +x.domain()[1]] },
    y: { kind: "number", domain: [y.domain()[0], y.domain()[1]] },
    points: { px, py, x: keptX, y: keptY, id: keptId },
    total: n,
  };
}
