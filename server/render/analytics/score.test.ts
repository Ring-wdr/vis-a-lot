import { describe, expect, it } from "vitest";
import {
  computeScores,
  cpk,
  formatScore,
  fscore,
  rscore,
  zscore,
} from "./score";

describe("score", () => {
  it("rscore: 완전 상관은 ±1, 분산 0이면 null", () => {
    expect(rscore([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(rscore([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(rscore([1, 2, 3], [5, 5, 5])).toBeNull();
    expect(rscore([1], [1])).toBeNull();
  });

  it("fscore: 일원 분산분석 예제", () => {
    // 세 묶음 [1,2,3], [4,5,6], [7,8,9]: SSB=54 (df 2), SSW=6 (df 6) → F = 27/1 = 27
    const ys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const g = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    expect(fscore(ys, g)).toBeCloseTo(27);
    expect(fscore([1, 2, 3], [0, 0, 0])).toBeNull();
  });

  it("zscore: 평균 ± 1.96σ 안 확률은 0.95", () => {
    const ys = [-1, 1, -1, 1]; // 평균 0, 표본 표준편차 √(4/3)
    const sd = Math.sqrt(4 / 3);
    expect(zscore(ys, { ucl: 1.96 * sd, lcl: -1.96 * sd })).toBeCloseTo(
      0.95,
      3,
    );
    expect(zscore(ys, { ucl: 0, lcl: null })).toBeCloseTo(0.5, 5);
    expect(zscore(ys, { ucl: null, lcl: null })).toBeNull();
    expect(zscore([3, 3], { ucl: 5, lcl: 1 })).toBe(1);
    expect(zscore([3, 3], { ucl: 2, lcl: 1 })).toBe(0);
  });

  it("cpk: 가까운 한계 쪽 (UCL-μ)/3σ", () => {
    const ys = [9, 11, 9, 11]; // μ=10, σ=√(4/3)
    const sd = Math.sqrt(4 / 3);
    expect(cpk(ys, { ucl: 14, lcl: 8 })).toBeCloseTo(2 / (3 * sd));
    expect(cpk(ys, { ucl: 14, lcl: null })).toBeCloseTo(4 / (3 * sd));
    expect(cpk(ys, { ucl: null, lcl: null })).toBeNull();
    expect(cpk([5, 5], { ucl: 6, lcl: 4 })).toBeNull();
  });

  it("computeScores는 고른 순서대로 글자를 만든다", () => {
    const r = computeScores(
      ["cpk", "rscore", "fscore"],
      { xs: [1, 2, 3], ys: [1, 2, 3] },
      { ucl: null, lcl: null },
    );
    expect(r.map((s) => s.label)).toEqual(["Cpk = —", "r = 1", "F = —"]);
    expect(formatScore("fscore", 12.3456)).toBe("F = 12.3");
    expect(formatScore("zscore", 0.95)).toBe("z = 0.95");
  });
});
