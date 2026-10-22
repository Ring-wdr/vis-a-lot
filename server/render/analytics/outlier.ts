// Value 구역의 이상치: iqr은 Q1 - k·IQR .. Q3 + k·IQR, sigma는 평균 ± k·σ 밖을 뺀다.

import { meanSd, quantileSorted } from "./stats";

/** 이상치가 아닌 범위 [lo, hi]. 값이 없으면 전 범위 */
export function outlierBounds(
  values: ArrayLike<number>,
  method: "iqr" | "sigma",
  k: number,
): [number, number] {
  const finite = Array.from(values).filter(Number.isFinite);
  if (finite.length === 0)
    return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  if (method === "sigma") {
    const { mean, sd } = meanSd(finite);
    return [mean - k * sd, mean + k * sd];
  }
  const sorted = Float64Array.from(finite).sort();
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  return [q1 - k * iqr, q3 + k * iqr];
}

/** 범위 안 값이면 1. NaN은 0 */
export function keepMask(
  values: ArrayLike<number>,
  [lo, hi]: [number, number],
): Uint8Array {
  const mask = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++)
    mask[i] = values[i] >= lo && values[i] <= hi ? 1 : 0;
  return mask;
}
