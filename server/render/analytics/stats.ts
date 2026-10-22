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

/** 표준 정규 분위수(누적분포의 역함수). Acklam 유리 근사(상대 오차 1.2e-9). p는 (0, 1) */
export function normalQuantile(p: number) {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
    -30.66479806614716, 2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  if (p < low || p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(p < low ? p : 1 - p));
    const z =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return p < low ? z : -z;
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}
