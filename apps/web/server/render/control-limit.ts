// 관리선(controlLimit 구역)의 렌더 입력·metadata 모양과 그리기.
// 선 목록(options.controlLimit.lines)은 컬럼·함수만 적은 설정이라 렌더러가 그대로 그릴 수 없다.
// job-manager가 item마다 집계 값을 채운 ResolvedLimit[]로 바꿔 렌더 입력(ScatterInput.limits,
// CategoryInput.limits)에 싣고, 렌더러는 DB를 모른 채 이 값만 그린다. 영역·이탈 강조·글자·축 범위 같은
// 전체 설정은 렌더 입력의 options.controlLimit에서 읽는다.
// 렌더 모듈(Worker)만 import한다. job-manager는 타입만 가져다 쓴다.
//
// scatter·category 렌더러가 부르는 순서 (스펙 3.3):
//   prepareLimits → fitLimitDomain(축 범위) → visibleLimits(로그 축) → limitJudge(이탈 판정)
//   → drawLimitAreas(영역·띠 채움, 격자 아래) → 점·막대 → 선택 밖 흐리게 → drawLimitLines → 이탈 점
//   → drawLimitLabels → limitsMeta

import { compileExpression } from "./analytics/expression";
import type {
  ChartOptions,
  ControlLimitOptions,
  LimitAxis,
  LimitKind,
  LimitStyle,
  LimitType,
} from "./options";
import { alphaOf, fontPx } from "./style";
import { THEME } from "./theme";

/**
 * 구간 하나의 값: [x0, x1, v] 또는 띠면 [x0, x1, v, v2]. x0..x1은 x 데이터 값(시계열은 epoch ms)으로 적은 구간 경계이고,
 * 구간은 x 전체 범위를 LIMIT_BUCKETS개로 나눈 것 중 값이 있는 것만 x 순으로 담는다 (빈 구간은 빠진다).
 * v는 그 구간의 선 값, v2는 띠의 두 번째 컬럼 값이다. 띠는 두 값이 다 있는 구간만 담는다.
 */
export type LimitStep =
  | [x0: number, x1: number, v: number]
  | [x0: number, x1: number, v: number, v2: number];

/**
 * 값을 채운 관리선 하나. 렌더 입력과 metadata가 같은 값을 쓴다.
 *
 * - 값은 모두 그 축의 데이터 값이다. left는 y 값(bar stack100이면 %), bottom은 x 값(시계열은 epoch ms).
 *   식(expression)을 적용하지 않은 값이며, 로그 축에서 0 이하인 선은 렌더러가 그리지 않는다.
 * - 값을 구하지 못한 선(조회한 행이 없거나 전부 null, 구간별인데 값 있는 구간이 하나도 없음)은 job이 목록에서 뺀다.
 *   그래서 목록의 선은 모두 그릴 수 있다. 순서는 설정의 선 목록 순서다.
 * - 지원하지 않는 차트·하위 차트(controlLimitSupport가 null)면 job이 limits를 싣지 않는다.
 */
export type ResolvedLimit = {
  name: string;
  kind: LimitKind;
  axis: LimitAxis;
  /** 띠는 늘 "none" */
  type: LimitType;
  color: string;
  width: number;
  style: LimitStyle;
} & (
  | {
      /** 값 하나로 그리는 선: 기준선, 구간별이 아닌 컬럼 선·띠 */
      multi: false;
      value: number;
      /** 띠의 두 번째 컬럼 평균. 띠만 있다. */
      value2?: number;
    }
  | {
      /** 구간별 계단선·계단 띠 (left 축만). 이탈은 점이 든 구간의 값과 비교하고, 값이 없는 구간의 점은 판정하지 않는다. */
      multi: true;
      steps: LimitStep[];
    }
);

/** 화면 툴팁이 쓰는 선 하나. 값은 그린 좌표(식을 적용한 축 값)다 (구간별이면 value 대신 steps). */
export type LimitMetaLine = {
  name: string;
  axis: LimitAxis;
  type: LimitType;
  value?: number;
  /** 띠의 두 번째 값 */
  value2?: number;
  steps?: LimitStep[];
};

/**
 * ScatterMeta·CategoryMeta의 limits. 그린 선이 하나라도 있을 때만 있다.
 * out은 usl·lsl을 벗어난 점(막대) 수로, 그린 것 기준이다 (끈 legend 값·지운 점은 세지 않는다).
 * 규격 선이 없으면 0이다. 화면은 이 선 값으로 점이 이탈인지 판정한다.
 */
export type LimitsMeta = {
  lines: LimitMetaLine[];
  out: number;
};

// ── 그리기 ──────────────────────────────────────────────────────

type Ctx = OffscreenCanvasRenderingContext2D;
type Plot = { left: number; top: number; width: number; height: number };
type Project = (v: number) => number;

/** 그릴 좌표로 옮긴 선. 값은 식을 적용한 축 값이다. */
export type LimitView = LimitMetaLine & {
  kind: LimitKind;
  color: string;
  width: number;
  style: LimitStyle;
};

/** 띠 사이 채움의 진하기 (선 색 위 globalAlpha) */
export const BAND_FILL_ALPHA = 0.15;

/**
 * 축 식(expression)을 선 값에 옮기는 함수. 다른 축 변수에 기대지 않는 식(예: `y / 1000`)만 옮길 수 있어,
 * 다른 축 변수를 NaN으로 넣어 본다. 다른 축 변수를 쓰는 식이면 NaN이 나와 그 선은 빠진다.
 * 빈 식·틀린 식(데이터도 그대로 그린다)이면 undefined.
 */
export function limitTransforms(expression: { x: string; y: string }): {
  x?: Project;
  y?: Project;
} {
  const of = (src: string, axis: "x" | "y") => {
    if (!src.trim()) return undefined;
    const c = compileExpression(src);
    if (!c.ok) return undefined;
    return axis === "x"
      ? (v: number) => c.fn(v, Number.NaN)
      : (v: number) => c.fn(Number.NaN, v);
  };
  return { x: of(expression.x, "x"), y: of(expression.y, "y") };
}

/**
 * 받은 선을 그릴 좌표로 옮긴다. 기준선은 사용자가 축 눈금을 보고 적은 값이라 그대로 두고,
 * 데이터에서 집계한 컬럼 선·띠와 구간 경계(x)에만 축 식을 적용한다. 값이 유한하지 않은 선·구간은 뺀다.
 */
export function prepareLimits(
  limits: readonly ResolvedLimit[] | undefined,
  transform: { x?: Project; y?: Project } = {},
): LimitView[] {
  if (!limits || limits.length === 0) return [];
  const out: LimitView[] = [];
  for (const l of limits) {
    const base = {
      name: l.name,
      axis: l.axis,
      type: l.kind === "band" ? ("none" as const) : l.type,
      kind: l.kind,
      color: l.color,
      width: l.width,
      style: l.style,
    };
    const tv =
      (l.kind === "reference" ? undefined : transform[axisVar(l.axis)]) ?? same;
    if (!l.multi) {
      const value = tv(l.value);
      const value2 = l.kind === "band" ? tv(l.value2 ?? Number.NaN) : undefined;
      if (!Number.isFinite(value)) continue;
      if (l.kind === "band" && !Number.isFinite(value2)) continue;
      out.push({ ...base, value, ...(l.kind === "band" ? { value2 } : {}) });
      continue;
    }
    // 구간별은 left 축만 있다. 경계는 x 식, 값은 y 식으로 옮긴다.
    const tx = transform.x ?? same;
    const steps: LimitStep[] = [];
    for (const s of l.steps) {
      const a = tx(s[0]);
      const b = tx(s[1]);
      const v = tv(s[2]);
      if (![a, b, v].every(Number.isFinite)) continue;
      const x0 = Math.min(a, b);
      const x1 = Math.max(a, b);
      if (l.kind === "band") {
        const v2 = tv(s[3] ?? Number.NaN);
        if (!Number.isFinite(v2)) continue;
        steps.push([x0, x1, v, v2]);
      } else {
        steps.push([x0, x1, v]);
      }
    }
    if (steps.length === 0) continue;
    steps.sort((p, q) => p[0] - q[0]);
    out.push({ ...base, steps });
  }
  return out;
}

const same: Project = (v) => v;
const axisVar = (axis: LimitAxis) => (axis === "left" ? "y" : "x");

/** 선이 그 축에 쓰는 값 전부 (축 범위 넓히기용) */
function valuesOf(line: LimitView): number[] {
  if (line.steps) return line.steps.flatMap((s) => s.slice(2));
  return [line.value, line.value2].filter((v): v is number => v !== undefined);
}

/**
 * fitAxis: 확대하지 않았을 때 선 값이 보이도록 축 범위를 넓힌다 (예측의 extendDomain과 같다).
 * log를 켠 축은 0 이하 값을 넣지 않는다 (넣으면 축이 선형으로 돌아간다). 축 최소·최대는 이 뒤에 이긴다.
 */
export function fitLimitDomain(
  domain: [number, number],
  lines: readonly LimitView[],
  axis: LimitAxis,
  log: boolean,
): [number, number] {
  let [lo, hi] = domain;
  for (const line of lines) {
    if (line.axis !== axis) continue;
    for (const v of valuesOf(line)) {
      if (log && v <= 0) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}

/** 로그 축에서 그릴 수 없는 값(0 이하)을 뺀 선. 구간별은 그 구간만 빼고, 남는 구간이 없으면 선을 뺀다. */
export function visibleLimits(
  lines: readonly LimitView[],
  log: { left: boolean; bottom: boolean },
): LimitView[] {
  const out: LimitView[] = [];
  for (const line of lines) {
    if (!log[line.axis]) {
      out.push(line);
      continue;
    }
    if (line.steps) {
      const steps = line.steps.filter((s) => s.slice(2).every((v) => v > 0));
      if (steps.length > 0) out.push({ ...line, steps });
    } else if (valuesOf(line).every((v) => v > 0)) {
      out.push(line);
    }
  }
  return out;
}

/** x가 든 구간. 경계에 놓인 점은 오른쪽 구간에 든다 (마지막 구간은 끝을 포함한다). */
export function stepAt(steps: readonly LimitStep[], x: number) {
  let lo = 0;
  let hi = steps.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid][0] <= x) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return undefined;
  const s = steps[found];
  return x <= s[1] ? s : undefined;
}

/** 축 하나의 USL·LSL 선 (검증이 축마다 하나씩만 두게 하므로 처음 것) */
function specOf(lines: readonly LimitView[], axis: LimitAxis) {
  return {
    usl: lines.find((l) => l.axis === axis && l.type === "usl"),
    lsl: lines.find((l) => l.axis === axis && l.type === "lsl"),
  };
}

/** 선의 값: 구간별이면 at이 든 구간의 값, 없으면 undefined */
function valueAt(line: LimitView | undefined, at: number) {
  if (!line) return undefined;
  if (line.steps) return stepAt(line.steps, at)?.[2];
  return line.value;
}

/**
 * 이탈 판정 함수 (x, y) → 벗어났는지. USL·LSL 선이 없으면 undefined.
 * left 축은 y를, bottom 축은 x를 본다 (구간별 left 선은 점 x가 든 구간의 값). 두 축 중 하나라도 벗어나면 이탈이다.
 * 상한이 하한보다 작은 뒤집힌 규격(그 구간)은 판정하지 않는다.
 */
export function limitJudge(
  lines: readonly LimitView[],
): ((x: number, y: number) => boolean) | undefined {
  const axes = (["left", "bottom"] as const)
    .map((axis) => ({ axis, ...specOf(lines, axis) }))
    .filter((s) => s.usl || s.lsl);
  if (axes.length === 0) return undefined;
  return (x, y) =>
    axes.some(({ axis, usl, lsl }) => {
      const [v, at] = axis === "left" ? [y, x] : [x, y];
      const u = valueAt(usl, at);
      const l = valueAt(lsl, at);
      if (u !== undefined && l !== undefined && u < l) return false;
      return (u !== undefined && v > u) || (l !== undefined && v < l);
    });
}

/** Score(zscore·Cpk)에 쓰는 구간별이 아닌 left 축 USL·LSL (3.6). 직접 적은 score.ucl·lcl이 우선이다. */
export function scoreLimits(
  lines: readonly LimitView[],
  score: { ucl: number | null; lcl: number | null },
) {
  const { usl, lsl } = specOf(lines, "left");
  return {
    ucl: score.ucl ?? (usl && !usl.steps ? (usl.value ?? null) : null),
    lcl: score.lcl ?? (lsl && !lsl.steps ? (lsl.value ?? null) : null),
  };
}

/** 그린 선이 있을 때만 metadata를 싣는다. */
export function limitsMeta(
  lines: readonly LimitView[],
  out: number,
): { limits: LimitsMeta } | Record<string, never> {
  if (lines.length === 0) return {};
  return {
    limits: {
      lines: lines.map(({ name, axis, type, value, value2, steps }) => ({
        name,
        axis,
        type,
        ...(steps ? { steps } : { value }),
        ...(value2 !== undefined ? { value2 } : {}),
      })),
      out,
    },
  };
}

/** 이탈 수를 적을지: USL·LSL로 정한 선이 하나라도 있으면 (0개여도 적는다) */
export function hasSpec(lines: readonly LimitView[]) {
  return lines.some((l) => l.type !== "none");
}

type Axes = { x: Project; y: Project; plot: Plot };

/** 값 구간 [lo, hi]를 그 축의 픽셀 구간으로. ±Infinity는 그림 영역 끝이다. */
function spanPx(axis: LimitAxis, lo: number, hi: number, { x, y, plot }: Axes) {
  const bottom = plot.top + plot.height;
  const right = plot.left + plot.width;
  const at = (v: number) =>
    axis === "left"
      ? v === Number.POSITIVE_INFINITY
        ? plot.top
        : v === Number.NEGATIVE_INFINITY
          ? bottom
          : y(v)
      : v === Number.POSITIVE_INFINITY
        ? right
        : v === Number.NEGATIVE_INFINITY
          ? plot.left
          : x(v);
  const a = at(lo);
  const b = at(hi);
  return [Math.min(a, b), Math.max(a, b)] as const;
}

/**
 * 선과 나란한 방향(left는 x)으로 나눈 조각 [from, to]마다 fill(from, to, at)을 부른다.
 * 구간별 선이 없으면 그림 영역 전체 한 조각, 있으면 그 구간 경계로 나눈 조각 (at은 조각 가운데 값).
 */
function eachPiece(
  lines: readonly (LimitView | undefined)[],
  axis: LimitAxis,
  a: Axes,
  fill: (from: number, to: number, at: number) => void,
) {
  const multi = lines.filter((l): l is LimitView => !!l?.steps);
  if (multi.length === 0) {
    const [from, to] =
      axis === "left"
        ? [a.plot.left, a.plot.left + a.plot.width]
        : [a.plot.top, a.plot.top + a.plot.height];
    fill(from, to, Number.NaN);
    return;
  }
  const cuts = [
    ...new Set(
      multi.flatMap((l) => (l.steps ?? []).flatMap((s) => [s[0], s[1]])),
    ),
  ].sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const mid = (cuts[k] + cuts[k + 1]) / 2;
    const p0 = a.x(cuts[k]);
    const p1 = a.x(cuts[k + 1]);
    fill(Math.min(p0, p1), Math.max(p0, p1), mid);
  }
}

function fillBand(
  ctx: Ctx,
  axis: LimitAxis,
  along: readonly [number, number],
  across: readonly [number, number],
) {
  const [a0, a1] = along;
  const [c0, c1] = across;
  if (a1 <= a0 || c1 <= c0) return;
  if (axis === "left") ctx.fillRect(a0, c0, a1 - a0, c1 - c0);
  else ctx.fillRect(c0, a0, c1 - c0, a1 - a0);
}

/**
 * 영역 채우기(area)와 띠 사이 채움. 격자보다 먼저(아래) 그린다.
 * In: LSL..USL(하나뿐이면 선에서 그림 영역 끝까지 규격 안쪽), Out: 그 바깥. 뒤집힌 규격(조각)은 채우지 않는다.
 */
export function drawLimitAreas(
  ctx: Ctx,
  lines: readonly LimitView[],
  o: ControlLimitOptions,
  a: Axes,
) {
  if (lines.length === 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.plot.left, a.plot.top, a.plot.width, a.plot.height);
  ctx.clip();
  // 띠: 두 값 사이를 선 색으로 옅게
  for (const line of lines) {
    if (line.kind !== "band") continue;
    ctx.globalAlpha = BAND_FILL_ALPHA;
    ctx.fillStyle = line.color;
    eachPiece([line], line.axis, a, (from, to, at) => {
      const v = line.steps ? stepAt(line.steps, at) : undefined;
      const v1 = line.steps ? v?.[2] : line.value;
      const v2 = line.steps ? v?.[3] : line.value2;
      if (v1 === undefined || v2 === undefined) return;
      fillBand(
        ctx,
        line.axis,
        [from, to],
        spanPx(line.axis, Math.min(v1, v2), Math.max(v1, v2), a),
      );
    });
  }
  if (o.area.visible) {
    ctx.globalAlpha = alphaOf(o.area.transparency);
    ctx.fillStyle = o.area.color;
    for (const axis of ["left", "bottom"] as const) {
      const { usl, lsl } = specOf(lines, axis);
      if (!usl && !lsl) continue;
      eachPiece([usl, lsl], axis, a, (from, to, at) => {
        const u = valueAt(usl, at);
        const l = valueAt(lsl, at);
        // 구간별 선이 이 조각에 값이 없으면 채우지 않는다.
        if ((usl && u === undefined) || (lsl && l === undefined)) return;
        if (u !== undefined && l !== undefined && u < l) return;
        const ranges: [number, number][] =
          o.area.side === "in"
            ? [[l ?? Number.NEGATIVE_INFINITY, u ?? Number.POSITIVE_INFINITY]]
            : [
                ...(u !== undefined
                  ? [[u, Number.POSITIVE_INFINITY] as [number, number]]
                  : []),
                ...(l !== undefined
                  ? [[Number.NEGATIVE_INFINITY, l] as [number, number]]
                  : []),
              ];
        for (const [lo, hi] of ranges) {
          fillBand(ctx, axis, [from, to], spanPx(axis, lo, hi, a));
        }
      });
    }
  }
  ctx.restore();
}

/** 선 모양(style)을 선 굵기에 맞춘 대시로 */
function dashOf(style: LimitStyle, width: number): number[] {
  const w = Math.max(1, width);
  if (style === "dash") return [w * 4, w * 3];
  // 끝이 둥근 짧은 대시가 점으로 보인다.
  if (style === "dot") return [0.01, w * 2.5];
  return [];
}

/** 홀수 굵기 선은 픽셀 가운데(.5)에 놓아 흐려지지 않게 한다. */
function crisp(p: number, width: number) {
  return Math.round(width) % 2 === 1 ? Math.round(p) + 0.5 : Math.round(p);
}

/** 구간별 선 하나를 계단으로 긋는다. 값 있는 구간이 이어지는 동안만 잇고, 빈 구간에서 끊는다. */
function traceSteps(
  ctx: Ctx,
  steps: readonly LimitStep[],
  pick: (s: LimitStep) => number,
  a: Axes,
  width: number,
) {
  // 구간 경계는 같은 값을 쓰지만 소수 오차를 둔다.
  const span = steps[steps.length - 1][1] - steps[0][0];
  const eps = Math.abs(span) * 1e-9;
  let prev: LimitStep | undefined;
  for (const s of steps) {
    const py = crisp(a.y(pick(s)), width);
    if (prev && s[0] - prev[1] <= eps) {
      ctx.lineTo(a.x(s[0]), py);
    } else {
      ctx.moveTo(a.x(s[0]), py);
    }
    ctx.lineTo(a.x(s[1]), py);
    prev = s;
  }
}

/**
 * 관리선. 선택 밖 흐리게 다음에 그려 덮이지 않는다. 사용자가 정한 색·굵기·모양 그대로다.
 * 섬네일(compact)은 굵기를 2/3로 줄인다 (최소 1).
 */
export function drawLimitLines(
  ctx: Ctx,
  lines: readonly LimitView[],
  a: Axes,
  compact = false,
) {
  if (lines.length === 0) return;
  const { plot } = a;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  ctx.globalAlpha = 1;
  for (const line of lines) {
    const width = compact ? Math.max(1, (line.width * 2) / 3) : line.width;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = width;
    ctx.lineCap = line.style === "dot" ? "round" : "butt";
    ctx.lineJoin = "miter";
    ctx.setLineDash(dashOf(line.style, width));
    ctx.beginPath();
    if (line.steps) {
      traceSteps(ctx, line.steps, (s) => s[2], a, width);
      if (line.kind === "band")
        traceSteps(ctx, line.steps, (s) => s[3] ?? s[2], a, width);
    } else {
      for (const v of valuesOf(line)) {
        if (line.axis === "left") {
          const py = crisp(a.y(v), width);
          ctx.moveTo(plot.left, py);
          ctx.lineTo(plot.left + plot.width, py);
        } else {
          const px = crisp(a.x(v), width);
          ctx.moveTo(px, plot.top);
          ctx.lineTo(px, plot.top + plot.height);
        }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 글자 상자 */
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (p: Box, q: Box) =>
  p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

/**
 * 선 끝의 `이름 값` 글자. left 축은 오른쪽 끝 위, bottom 축은 위쪽 끝 오른쪽에 둔다.
 * 다른 글자와 겹치면 left는 선 아래로, 그래도 겹치면 한 줄씩 비켜 가며 자리를 찾고, 그림 영역을 벗어나면 그리지 않는다.
 * 선이 그림 영역 밖이면(확대·fitAxis 끔) 글자도 그리지 않는다. 바탕색 테두리를 둘러 점 위에서도 읽힌다.
 */
export function drawLimitLabels(
  ctx: Ctx,
  lines: readonly LimitView[],
  o: ChartOptions,
  a: Axes,
  format: { left: (v: number) => string; bottom: (v: number) => string },
) {
  const t = o.controlLimit.text;
  if (!t.visible || lines.length === 0) return;
  const { plot } = a;
  const right = plot.left + plot.width;
  const bottom = plot.top + plot.height;
  const font = fontPx(o, 10, t.fontSize);
  const h = font + 2;
  const gap = 3;
  const placed: Box[] = [];
  const free = (b: Box) =>
    b.x >= plot.left &&
    b.x + b.w <= right &&
    b.y >= plot.top &&
    b.y + b.h <= bottom &&
    !placed.some((p) => overlaps(p, b));
  ctx.save();
  ctx.font = `${font}px ${THEME.font}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  for (const line of lines) {
    const fmt = format[line.axis];
    // 구간별은 오른쪽 끝 구간의 값을 적는다.
    const last = line.steps?.[line.steps.length - 1];
    const v1 = last ? last[2] : (line.value ?? Number.NaN);
    const v2 = last ? last[3] : line.value2;
    const value =
      v2 === undefined
        ? fmt(v1)
        : `${fmt(Math.min(v1, v2))} ~ ${fmt(Math.max(v1, v2))}`;
    const text = `${line.name} ${value}`;
    const w = ctx.measureText(text).width;
    let box: Box | undefined;
    if (line.axis === "left") {
      // 띠는 위쪽 선에 단다.
      const py = a.y(v2 === undefined ? v1 : Math.max(v1, v2));
      const endX = last ? Math.min(right, a.x(last[1])) : right;
      if (!(py >= plot.top && py <= bottom) || !(endX > plot.left)) continue;
      const x = endX - 4 - w;
      const tries = [py - gap - h, py + gap];
      for (let k = 1; k <= 4; k++)
        tries.push(py - gap - h - k * h, py + gap + k * h);
      for (const y of tries) {
        const b = { x, y, w, h };
        if (free(b)) {
          box = b;
          break;
        }
      }
    } else {
      const px = a.x(v2 === undefined ? v1 : Math.max(v1, v2));
      if (!(px >= plot.left && px <= right)) continue;
      // 오른쪽에 자리가 없으면 선 왼쪽
      const xs = [px + 4, px - 4 - w];
      for (let k = 0; k <= 4 && !box; k++) {
        for (const x of xs) {
          const b = { x, y: plot.top + 2 + k * h, w, h };
          if (free(b)) {
            box = b;
            break;
          }
        }
      }
    }
    if (!box) continue;
    placed.push(box);
    const color =
      t.color ||
      (line.axis === "left" ? o.axes.y.label.color : o.axes.x.label.color);
    ctx.strokeStyle = o.panel.backColor;
    ctx.lineWidth = 3;
    ctx.strokeText(text, box.x, box.y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, box.x, box.y + 1);
  }
  ctx.restore();
}
