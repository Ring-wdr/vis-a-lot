import { describe, expect, it } from "vitest";
import { toDistribution } from "./distribution";
import { normalCdf, normalQuantile } from "./stats";

const src = {
  xs: Float64Array.from([10, 20, 30, 40, 50]),
  ys: Float64Array.from([3, 1, 2, 5, 4]),
  ids: Float64Array.from([100, 101, 102, 103, 104]),
  legend: Uint8Array.from([1, 0, 1, 0, 1]),
};

describe("toDistribution", () => {
  it("ECDF는 계열마다 값 순으로 놓고 누적 비율을 y로 둔다", () => {
    const out = toDistribution("ecdf", src, [{ start: 0, end: 5 }]);
    // 계열 0: 1(101), 5(103) / 계열 1: 2(102), 3(100), 4(104)
    expect([...out.xs]).toEqual([1, 5, 2, 3, 4]);
    expect([...out.ids]).toEqual([101, 103, 102, 100, 104]);
    expect([...(out.legend ?? [])]).toEqual([0, 0, 1, 1, 1]);
    expect([...out.ys]).toEqual([0.5, 1, 1 / 3, 2 / 3, 1]);
  });

  it("split 구간 밖으로 섞지 않는다", () => {
    const out = toDistribution("ecdf", { ...src, legend: undefined }, [
      { start: 0, end: 2 },
      { start: 2, end: 5 },
    ]);
    expect([...out.xs]).toEqual([1, 3, 2, 4, 5]);
  });

  it("정규 확률은 대칭인 z를, 정규 CDF는 0~1 사이 값을 준다", () => {
    const prob = toDistribution("probability", { ...src, legend: undefined }, [
      { start: 0, end: 5 },
    ]);
    expect(prob.ys[2]).toBeCloseTo(0, 6);
    expect(prob.ys[0]).toBeCloseTo(-prob.ys[4], 6);
    const ncdf = toDistribution("ncdf", { ...src, legend: undefined }, [
      { start: 0, end: 5 },
    ]);
    expect(ncdf.ys[2]).toBeCloseTo(0.5, 6);
    for (const v of ncdf.ys) expect(v).toBeGreaterThan(0);
  });
});

describe("normalQuantile", () => {
  it("normalCdf의 역함수다", () => {
    for (const p of [0.001, 0.02, 0.3, 0.5, 0.9, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 5);
    }
  });
});
