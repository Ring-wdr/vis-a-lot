// Value 구역의 이상치: iqr은 Q1 - k·IQR .. Q3 + k·IQR, sigma는 평균 ± k·σ 밖이 이상치다.
// outlierMode가 except면 이상치를 빼고, only면 이상치만 남긴다.

import type { OutlierMode } from "../options";
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

/** 남길 값인지. except: 범위 안, only: 범위 밖(이상치). NaN은 어느 쪽도 아니다. */
export function keepsValue(
  v: number,
  [lo, hi]: [number, number],
  mode: OutlierMode = "except",
) {
  if (Number.isNaN(v)) return false;
  const inside = v >= lo && v <= hi;
  return mode === "only" ? !inside : inside;
}

/** 남길 값이면 1 (keepsValue). NaN은 0 */
export function keepMask(
  values: ArrayLike<number>,
  bounds: [number, number],
  mode: OutlierMode = "except",
): Uint8Array {
  const mask = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++)
    mask[i] = keepsValue(values[i], bounds, mode) ? 1 : 0;
  return mask;
}
