import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, type PredictionOptions } from "../options";
import { downsample, predict } from "./prediction";

const opts = (o: Partial<PredictionOptions>): PredictionOptions => ({
  ...DEFAULT_OPTIONS.prediction,
  enabled: true,
  ...o,
});
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("prediction", () => {
  it("sma: 마지막 window개 평균, x는 중앙 간격으로", () => {
    const r = predict(
      [0, 2, 4, 6],
      [1, 2, 3, 4],
      opts({ method: "sma", window: 2, period: 3 }),
    );
    expect(r?.ys).toEqual([3.5, 3.5, 3.5]);
    expect(r?.xs).toEqual([8, 10, 12]);
    expect(predict([0], [1], opts({ method: "sma", window: 2 }))).toBeNull();
  });

  it("ses: alpha=1이면 마지막 값", () => {
    const r = predict(
      range(5),
      [3, 1, 4, 1, 5],
      opts({ method: "ses", alpha: 1, period: 2 }),
    );
    expect(r?.ys).toEqual([5, 5]);
    expect(r?.params.alpha).toBe(1);
  });

  it("des: 직선은 그대로 이어간다, 자동 맞춤", () => {
    const ys = range(30).map((i) => 2 * i + 1);
    const r = predict(range(30), ys, opts({ method: "des", period: 3 }));
    expect(r?.ys[0]).toBeCloseTo(61, 0);
    expect(r?.ys[2]).toBeCloseTo(65, 0);
  });

  it("holtWinters: 계절 계열은 ses보다 잘 맞힌다", () => {
    const m = 12;
    const f = (i: number) =>
      50 + 0.5 * i + 10 * Math.sin((2 * Math.PI * i) / m);
    const train = range(96);
    const test = range(12).map((h) => f(96 + h));
    const err = (ys: number[]) =>
      ys.reduce((s, y, i) => s + (y - test[i]) ** 2, 0);
    const hw = predict(
      train,
      train.map(f),
      opts({ method: "holtWinters", seasonLength: m, period: 12 }),
    );
    const ses = predict(
      train,
      train.map(f),
      opts({ method: "ses", period: 12 }),
    );
    expect(hw).not.toBeNull();
    expect(err(hw?.ys ?? [])).toBeLessThan(err(ses?.ys ?? []) / 5);
    expect(hw?.description).toContain("Holt-Winters");
    expect(
      predict(
        range(20),
        range(20),
        opts({ method: "holtWinters", seasonLength: 12 }),
      ),
    ).toBeNull();
  });

  it("곱셈은 0 이하 값이 있으면 덧셈으로 바꾸고 설명에 적는다", () => {
    const ys = range(40).map((i) => i - 5);
    const r = predict(
      range(40),
      ys,
      opts({ method: "des", trend: "multiplicative" }),
    );
    expect(r?.description).toContain("덧셈");
  });

  it("신뢰 구간은 √h로 넓어진다", () => {
    const ys = range(50).map((i) => (i % 2 ? 1 : -1));
    const r = predict(
      range(50),
      ys,
      opts({ method: "ses", alpha: 0.5, showInterval: true, period: 4 }),
    );
    const w = (h: number) => (r?.upper?.[h] ?? 0) - (r?.lower?.[h] ?? 0);
    expect(w(0)).toBeGreaterThan(0);
    expect(w(3) / w(0)).toBeCloseTo(2);
  });

  it("긴 계열은 x 구간 평균으로 줄인다", () => {
    const n = 100_000;
    const xs = range(n);
    const d = downsample(xs, xs, 2000);
    expect(d.xs.length).toBe(2000);
    expect(d.ys[0]).toBeCloseTo(24.5);
    const started = performance.now();
    const r = predict(
      xs,
      xs.map((i) => Math.sin(i / 500)),
      opts({ method: "holtWinters", seasonLength: 12 }),
    );
    expect(r).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
