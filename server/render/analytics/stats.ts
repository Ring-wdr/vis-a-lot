// 분석 모듈이 함께 쓰는 기초 통계. NaN은 호출하는 쪽에서 미리 뺀다.

/** 평균과 표본 표준편차(n-1). 값이 없으면 NaN */
export function meanSd(values: ArrayLike<number>) {
  const n = values.length;
  if (n === 0) return { mean: Number.NaN, sd: Number.NaN, n };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (values[i] - mean) ** 2;
  return { mean, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : 0, n };
}

/** 오차 함수 근사 (Abramowitz–Stegun 7.1.26, 오차 1.5e-7) */
function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/** 표준 정규 누적분포 */
export function normalCdf(z: number) {
  if (z === Number.POSITIVE_INFINITY) return 1;
  if (z === Number.NEGATIVE_INFINITY) return 0;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** 정렬된 배열의 분위수 (선형 보간, R type 7) */
export function quantileSorted(sorted: ArrayLike<number>, p: number) {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}
