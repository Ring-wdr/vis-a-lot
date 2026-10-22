// Score 구역: 점 차트(scatter, line) 상자에 적는 점수.
// rscore = x·y 피어슨 상관, fscore = legend 묶음별 y의 일원 분산분석 F,
// zscore = y가 정규분포(평균, 표준편차)일 때 LCL..UCL 안에 들 확률, cpk = 공정 능력 지수.

import type { ScoreKind } from "../options";
import { meanSd, normalCdf } from "./stats";

export type ScoreInput = {
  xs: ArrayLike<number>;
  ys: ArrayLike<number>;
  /** 점마다의 묶음 번호 (legend 인덱스). fscore에만 쓴다. */
  groups?: ArrayLike<number>;
};
export type ScoreLimits = { ucl: number | null; lcl: number | null };
export type ScoreResult = {
  kind: ScoreKind;
  value: number | null;
  label: string;
};

/** 피어슨 상관계수. 점이 2개 미만이거나 한쪽 분산이 0이면 null */
export function rscore(xs: ArrayLike<number>, ys: ArrayLike<number>) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/** 일원 분산분석 F. 값이 있는 묶음이 2개 미만이거나 묶음 안 분산이 0이면 null */
export function fscore(ys: ArrayLike<number>, groups: ArrayLike<number>) {
  const sums = new Map<number, { sum: number; n: number }>();
  const n = Math.min(ys.length, groups.length);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const g = sums.get(groups[i]) ?? { sum: 0, n: 0 };
    g.sum += ys[i];
    g.n++;
    sums.set(groups[i], g);
    total += ys[i];
  }
  const k = sums.size;
  if (k < 2 || n <= k) return null;
  const grand = total / n;
  let ssb = 0;
  for (const g of sums.values()) ssb += g.n * (g.sum / g.n - grand) ** 2;
  let ssw = 0;
  for (let i = 0; i < n; i++) {
    const g = sums.get(groups[i]) as { sum: number; n: number };
    ssw += (ys[i] - g.sum / g.n) ** 2;
  }
  if (ssw === 0) return null;
  return ssb / (k - 1) / (ssw / (n - k));
}

/**
 * y가 LCL..UCL 안에 들 확률. 한쪽 한계만 있으면 그쪽만 본다. 한계가 없으면 null,
 * 표준편차가 0이면 평균이 안에 있는지로 1 또는 0이다.
 */
export function zscore(ys: ArrayLike<number>, { ucl, lcl }: ScoreLimits) {
  if (ucl === null && lcl === null) return null;
  const { mean, sd, n } = meanSd(ys);
  if (n === 0) return null;
  const hi = ucl ?? Number.POSITIVE_INFINITY;
  const lo = lcl ?? Number.NEGATIVE_INFINITY;
  if (sd === 0) return mean >= lo && mean <= hi ? 1 : 0;
  return Math.max(0, normalCdf((hi - mean) / sd) - normalCdf((lo - mean) / sd));
}

/** Cpk = min((UCL-μ)/3σ, (μ-LCL)/3σ). 한쪽 한계만 있으면 그쪽만, 한계가 없거나 σ=0이면 null */
export function cpk(ys: ArrayLike<number>, { ucl, lcl }: ScoreLimits) {
  if (ucl === null && lcl === null) return null;
  const { mean, sd, n } = meanSd(ys);
  if (n < 2 || sd === 0) return null;
  const sides: number[] = [];
  if (ucl !== null) sides.push((ucl - mean) / (3 * sd));
  if (lcl !== null) sides.push((mean - lcl) / (3 * sd));
  return Math.min(...sides);
}

const LABELS: Record<ScoreKind, string> = {
  rscore: "r",
  fscore: "F",
  zscore: "z",
  cpk: "Cpk",
};

/** 점수 글자. 값이 없으면 —, 큰 값은 유효 숫자 3자리 */
export function formatScore(kind: ScoreKind, value: number | null) {
  if (value === null || !Number.isFinite(value)) return `${LABELS[kind]} = —`;
  const text = Math.abs(value) >= 100 ? value.toFixed(0) : value.toPrecision(3);
  return `${LABELS[kind]} = ${Number(text)}`;
}

/** 고른 점수를 순서대로 계산한다. */
export function computeScores(
  kinds: readonly ScoreKind[],
  input: ScoreInput,
  limits: ScoreLimits,
): ScoreResult[] {
  return kinds.map((kind) => {
    const value =
      kind === "rscore"
        ? rscore(input.xs, input.ys)
        : kind === "fscore"
          ? input.groups
            ? fscore(input.ys, input.groups)
            : null
          : kind === "zscore"
            ? zscore(input.ys, limits)
            : cpk(input.ys, limits);
    return { kind, value, label: formatScore(kind, value) };
  });
}
