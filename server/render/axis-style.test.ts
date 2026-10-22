import { scaleLinear } from "d3-scale";
import { describe, expect, it } from "vitest";
import { valueScale, xAxisSpace, yAxisSpace } from "./axis-style";
import { DEFAULT_OPTIONS, mergeOptions } from "./options";

const y = DEFAULT_OPTIONS.axes.y;

describe("valueScale", () => {
  it("기본값은 nice(5)를 건 선형 축과 같다", () => {
    const ref = scaleLinear().domain([0.3, 9.7]).range([100, 0]).nice(5);
    const v = valueScale([0.3, 9.7], [100, 0], y);
    expect(v.scale.domain()).toEqual(ref.domain());
    expect(v.ticks).toEqual(ref.ticks(5));
    expect(v.format(2)).toBe(ref.tickFormat(5)(2));
    expect(v.log).toBe(false);
  });

  it("min·max를 정하면 그 범위로 고정하고 nice를 걸지 않는다", () => {
    const v = valueScale([0.3, 9.7], [100, 0], { ...y, min: 1, max: 7 });
    expect(v.scale.domain()).toEqual([1, 7]);
  });

  it("확대 중이면 확대 범위가 이긴다", () => {
    const v = valueScale([2, 3], [100, 0], { ...y, min: 0 }, { zoomed: true });
    expect(v.scale.domain()).toEqual([2, 3]);
  });

  it("로그 축은 양수 범위에서만, 아니면 선형", () => {
    expect(valueScale([1, 1000], [100, 0], { ...y, log: true }).log).toBe(true);
    expect(valueScale([-1, 1000], [100, 0], { ...y, log: true }).log).toBe(
      false,
    );
  });

  it("소수 자리를 정하면 그 형식", () => {
    expect(valueScale([0, 10], [100, 0], { ...y, decimals: 2 }).format(2)).toBe(
      "2.00",
    );
  });
});

describe("axis space", () => {
  it("기본은 y: 글자 폭 + 14, x: 26", () => {
    expect(yAxisSpace(DEFAULT_OPTIONS, 20.3)).toBe(35);
    expect(xAxisSpace(DEFAULT_OPTIONS)).toBe(26);
  });

  it("축을 숨기거나 글자를 돌리면 자리가 바뀐다", () => {
    const hidden = mergeOptions(DEFAULT_OPTIONS, {
      axes: { y: { label: { visible: false } }, x: { visible: false } },
    });
    expect(yAxisSpace(hidden, 20)).toBe(14);
    expect(xAxisSpace(hidden)).toBe(8);
    const rotated = mergeOptions(DEFAULT_OPTIONS, {
      axes: { x: { label: { angle: 90 } } },
    });
    expect(xAxisSpace(rotated, 50)).toBe(7 + 50 + 8);
  });
});
