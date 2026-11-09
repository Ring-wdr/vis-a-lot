// Prediction 구역: x 순으로 정렬한 계열의 뒤를 예측한다.
// sma = 단순 이동 평균, ses = 단순 지수 평활, des = 이중 지수 평활(Holt 선형 추세),
// holtWinters = 추세 + 계절 지수 평활. 매개변수가 null이면 한 단계 앞 예측 오차 제곱합이
// 가장 작은 값을 거친 격자(평가 1000번 이하)에서 고른다.
// 점이 MAX_FIT_POINTS보다 많으면 x 범위를 같은 폭 구간으로 나눠 구간마다 x·y 평균 한 점으로 줄인 뒤 맞춘다
// (빈 구간은 건너뛴다). 그러면 예측 한 걸음도 구간 폭이 된다.

import type { PredictionOptions } from "../options";

export const MAX_FIT_POINTS = 2000;

export type PredictionResult = {
  xs: number[];
  ys: number[];
  /** showInterval일 때 ±1.96·RMSE·√h 띠 */
  lower?: number[];
  upper?: number[];
  params: Record<string, number>;
  description: string;
};

type Fit = {
  /** 한 단계 앞 예측 오차 제곱합과 개수 */
  sse: number;
  count: number;
  forecast: (h: number) => number;
};

/** 같은 폭 x 구간마다 평균 한 점으로 줄인다. */
export function downsample(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  max = MAX_FIT_POINTS,
) {
  const n = Math.min(xs.length, ys.length);
  if (n <= max)
    return { xs: Array.from(xs).slice(0, n), ys: Array.from(ys).slice(0, n) };
  const x0 = xs[0];
  const span = xs[n - 1] - x0;
  if (!(span > 0)) {
    // x가 모두 같으면 순서대로 같은 개수씩 묶는다.
    const size = Math.ceil(n / max);
    const ox: number[] = [];
    const oy: number[] = [];
    for (let i = 0; i < n; i += size) {
      const end = Math.min(n, i + size);
      let sy = 0;
      for (let j = i; j < end; j++) sy += ys[j];
      ox.push(x0);
      oy.push(sy / (end - i));
    }
    return { xs: ox, ys: oy };
  }
  const sumX = new Float64Array(max);
  const sumY = new Float64Array(max);
  const cnt = new Uint32Array(max);
  for (let i = 0; i < n; i++) {
    const b = Math.min(max - 1, Math.floor(((xs[i] - x0) / span) * max));
    sumX[b] += xs[i];
    sumY[b] += ys[i];
    cnt[b]++;
  }
  const ox: number[] = [];
  const oy: number[] = [];
  for (let b = 0; b < max; b++) {
    if (cnt[b] === 0) continue;
    ox.push(sumX[b] / cnt[b]);
    oy.push(sumY[b] / cnt[b]);
  }
  return { xs: ox, ys: oy };
}

function medianStep(xs: number[]) {
  const diffs: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 1;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

/** 0.05..0.95 사이 count개 */
function grid(count: number) {
  return Array.from(
    { length: count },
    (_, i) => 0.05 + (0.9 * i) / (count - 1),
  );
}

/** 고정 값이 있으면 그 값 하나, 없으면 격자 */
const candidates = (fixed: number | null, count: number) =>
  fixed === null ? grid(count) : [fixed];

function sma(ys: number[], window: number): Fit | null {
  if (ys.length < window) return null;
  let sum = 0;
  for (let i = 0; i < window; i++) sum += ys[i];
  let sse = 0;
  let count = 0;
  for (let t = window; t < ys.length; t++) {
    const e = ys[t] - sum / window;
    sse += e * e;
    count++;
    sum += ys[t] - ys[t - window];
  }
  const last = sum / window;
  return { sse, count, forecast: () => last };
}

function ses(ys: number[], alpha: number): Fit | null {
  if (ys.length < 2) return null;
  let level = ys[0];
  let sse = 0;
  for (let t = 1; t < ys.length; t++) {
    const e = ys[t] - level;
    sse += e * e;
    level += alpha * e;
  }
  return { sse, count: ys.length - 1, forecast: () => level };
}

type Kind = "additive" | "multiplicative";

/** 감쇠 계수 φ의 1..h 거듭제곱 합 */
function dampSum(phi: number, h: number) {
  if (phi === 1) return h;
  let s = 0;
  let p = 1;
  for (let i = 0; i < h; i++) {
    p *= phi;
    s += p;
  }
  return s;
}

function holt(
  ys: number[],
  alpha: number,
  beta: number,
  trend: Kind,
  phi: number,
): Fit | null {
  if (ys.length < 3) return null;
  const mul = trend === "multiplicative";
  let level = ys[0];
  let slope = mul ? ys[1] / ys[0] : ys[1] - ys[0];
  let sse = 0;
  for (let t = 1; t < ys.length; t++) {
    const pred = mul ? level * slope ** phi : level + phi * slope;
    const e = ys[t] - pred;
    sse += e * e;
    const prev = level;
    level = alpha * ys[t] + (1 - alpha) * pred;
    slope = mul
      ? beta * (level / prev) + (1 - beta) * slope ** phi
      : beta * (level - prev) + (1 - beta) * phi * slope;
  }
  return {
    sse,
    count: ys.length - 1,
    forecast: (h) =>
      mul ? level * slope ** dampSum(phi, h) : level + dampSum(phi, h) * slope,
  };
}

function holtWinters(
  ys: number[],
  alpha: number,
  beta: number,
  gamma: number,
  m: number,
  trend: Kind,
  seasonal: Kind,
  phi: number,
): Fit | null {
  const n = ys.length;
  if (m < 2 || n < 2 * m) return null;
  const mulT = trend === "multiplicative";
  const mulS = seasonal === "multiplicative";
  let mean1 = 0;
  let mean2 = 0;
  for (let i = 0; i < m; i++) {
    mean1 += ys[i] / m;
    mean2 += ys[m + i] / m;
  }
  let level = mean1;
  let slope = mulT ? (mean2 / mean1) ** (1 / m) : (mean2 - mean1) / m;
  const season = Array.from({ length: m }, (_, i) =>
    mulS ? ys[i] / mean1 : ys[i] - mean1,
  );
  let sse = 0;
  let count = 0;
  for (let t = m; t < n; t++) {
    const s = season[t % m];
    const base = mulT ? level * slope ** phi : level + phi * slope;
    const pred = mulS ? base * s : base + s;
    const e = ys[t] - pred;
    sse += e * e;
    count++;
    const prev = level;
    level = alpha * (mulS ? ys[t] / s : ys[t] - s) + (1 - alpha) * base;
    slope = mulT
      ? beta * (level / prev) + (1 - beta) * slope ** phi
      : beta * (level - prev) + (1 - beta) * phi * slope;
    season[t % m] =
      gamma * (mulS ? ys[t] / level : ys[t] - level) + (1 - gamma) * s;
  }
  return {
    sse,
    count,
    forecast: (h) => {
      const base = mulT
        ? level * slope ** dampSum(phi, h)
        : level + dampSum(phi, h) * slope;
      const s = season[(n + h - 1) % m];
      return mulS ? base * s : base + s;
    },
  };
}

/** 후보 매개변수 조합 중 오차 제곱합이 가장 작은 fit */
function best<P>(params: P[], run: (p: P) => Fit | null) {
  let found: { fit: Fit; p: P } | null = null;
  for (const p of params) {
    const fit = run(p);
    if (!fit || !Number.isFinite(fit.sse)) continue;
    if (!found || fit.sse < found.fit.sse) found = { fit, p };
  }
  return found;
}

const fmt = (v: number) => Number(v.toFixed(2)).toString();

/**
 * 예측. 점이 모자라면(sma < window, ses < 2, des < 3, holtWinters < 2·seasonLength) null.
 * 곱셈 추세·계절은 값이 모두 양수일 때만 쓰고, 아니면 덧셈으로 바꿔 설명에 적는다.
 */
export function predict(
  rawXs: ArrayLike<number>,
  rawYs: ArrayLike<number>,
  options: PredictionOptions,
): PredictionResult | null {
  const { xs, ys } = downsample(rawXs, rawYs);
  if (ys.length === 0 || options.period < 1) return null;
  const positive = ys.every((v) => v > 0);
  const notes: string[] = [];
  const kindOf = (k: Kind, what: string): Kind => {
    if (k === "multiplicative" && !positive) {
      notes.push(`${what} 덧셈으로 (0 이하 값)`);
      return "additive";
    }
    return k;
  };
  const phi = options.damped ? 0.98 : 1;
  let fit: Fit | null = null;
  let params: Record<string, number> = {};
  let name = "";

  switch (options.method) {
    case "sma": {
      const window = Math.round(options.window);
      fit = sma(ys, window);
      params = { window };
      name = `이동 평균 (n=${window})`;
      break;
    }
    case "ses": {
      const r = best(candidates(options.alpha, 19), (a) => ses(ys, a));
      if (r) {
        fit = r.fit;
        params = { alpha: r.p };
      }
      name = `단순 지수 평활 (α=${fmt(params.alpha ?? 0)})`;
      break;
    }
    case "des": {
      const trend = kindOf(options.trend, "추세");
      const combos = candidates(options.alpha, 10).flatMap((a) =>
        candidates(options.beta, 10).map((b) => [a, b] as const),
      );
      const r = best(combos, ([a, b]) => holt(ys, a, b, trend, phi));
      if (r) {
        fit = r.fit;
        params = { alpha: r.p[0], beta: r.p[1] };
      }
      name = `이중 지수 평활 (α=${fmt(params.alpha ?? 0)}, β=${fmt(params.beta ?? 0)})`;
      break;
    }
    case "holtWinters": {
      const m = Math.round(options.seasonLength);
      const trend = kindOf(options.trend, "추세");
      const seasonal = kindOf(options.seasonal, "계절");
      const combos = candidates(options.alpha, 8).flatMap((a) =>
        candidates(options.beta, 5).flatMap((b) =>
          candidates(options.gamma, 8).map((g) => [a, b, g] as const),
        ),
      );
      const r = best(combos, ([a, b, g]) =>
        holtWinters(ys, a, b, g, m, trend, seasonal, phi),
      );
      if (r) {
        fit = r.fit;
        params = {
          alpha: r.p[0],
          beta: r.p[1],
          gamma: r.p[2],
          seasonLength: m,
        };
      }
      name = `Holt-Winters (α=${fmt(params.alpha ?? 0)}, β=${fmt(params.beta ?? 0)}, γ=${fmt(params.gamma ?? 0)}, m=${m})`;
      break;
    }
  }
  if (!fit) return null;
  if (options.damped && options.method !== "sma" && options.method !== "ses")
    params.phi = phi;

  const step = medianStep(xs);
  const lastX = xs[xs.length - 1];
  const rmse = fit.count > 0 ? Math.sqrt(fit.sse / fit.count) : 0;
  const out: PredictionResult = {
    xs: [],
    ys: [],
    params,
    description: [name, ...notes].join(" · "),
  };
  if (options.showInterval) {
    out.lower = [];
    out.upper = [];
  }
  for (let h = 1; h <= options.period; h++) {
    const y = fit.forecast(h);
    out.xs.push(lastX + step * h);
    out.ys.push(Number.isFinite(y) ? y : Number.NaN);
    if (out.lower && out.upper) {
      const half = 1.96 * rmse * Math.sqrt(h);
      out.lower.push(y - half);
      out.upper.push(y + half);
    }
  }
  return out;
}
