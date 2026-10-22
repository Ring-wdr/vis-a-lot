import { describe, expect, it } from "vitest";
import { keepMask, outlierBounds } from "./outlier";

describe("outlier", () => {
  it("iqr: Q1 - k·IQR .. Q3 + k·IQR", () => {
    // 1..9: Q1=3, Q3=7, IQR=4 → [-3, 13]
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(outlierBounds(values, "iqr", 1.5)).toEqual([-3, 13]);
    expect(Array.from(keepMask([...values, 100], [-3, 13]))).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
    ]);
  });

  it("sigma: 평균 ± k·σ, NaN은 빼고 0으로 표시", () => {
    const [lo, hi] = outlierBounds([9, 11, 9, 11, Number.NaN], "sigma", 1);
    const sd = Math.sqrt(4 / 3);
    expect(lo).toBeCloseTo(10 - sd);
    expect(hi).toBeCloseTo(10 + sd);
    expect(Array.from(keepMask([Number.NaN, 10], [lo, hi]))).toEqual([0, 1]);
    expect(outlierBounds([], "iqr", 1.5)).toEqual([-Infinity, Infinity]);
  });
});
