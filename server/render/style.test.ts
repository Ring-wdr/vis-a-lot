import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, mergeOptions } from "./options";
import {
  alphaOf,
  createLabelGuard,
  fontPx,
  formatValue,
  gradientColors,
  headerHeight,
  lineWidthOf,
  pointSizeOf,
} from "./style";

const palette = DEFAULT_OPTIONS.palette;

describe("gradientColors", () => {
  it("시작에서 끝까지 n단계로 나눈다", () => {
    const colors = gradientColors(
      { ...palette, start: "#000000", end: "#ffffff" },
      3,
    );
    expect(colors).toEqual(["#000000", "#808080", "#ffffff"]);
  });

  it("중간 색과 뒤집기", () => {
    const p = {
      ...palette,
      start: "#000000",
      middle: "#ff0000",
      end: "#ffffff",
      reverse: true,
    };
    expect(gradientColors(p, 3)).toEqual(["#ffffff", "#ff0000", "#000000"]);
  });

  it("단계가 값보다 적으면 같은 단계 색을 함께 쓴다", () => {
    const p = { ...palette, start: "#000000", end: "#ffffff", steps: 2 };
    expect(gradientColors(p, 4)).toEqual([
      "#000000",
      "#000000",
      "#ffffff",
      "#ffffff",
    ]);
  });
});

describe("size", () => {
  it("기본값이면 차트가 정한 크기를 그대로 쓴다", () => {
    expect(fontPx(DEFAULT_OPTIONS, 11)).toBe(11);
    expect(fontPx(DEFAULT_OPTIONS, 12, 30)).toBe(12);
    expect(pointSizeOf(DEFAULT_OPTIONS, 2.5)).toBe(2.5);
    expect(lineWidthOf(DEFAULT_OPTIONS, 1)).toBe(1);
  });

  it("자동을 끄면 구역의 크기, 자동이면 범위 안으로", () => {
    const o = mergeOptions(DEFAULT_OPTIONS, {
      size: { fontAuto: false, pointAuto: false, pointFixed: 7, lineWidth: 3 },
    });
    expect(fontPx(o, 12, 20)).toBe(20);
    expect(pointSizeOf(o, 2.5)).toBe(7);
    expect(lineWidthOf(o, 1)).toBe(3);
    const clamped = mergeOptions(DEFAULT_OPTIONS, { size: { fontMin: 14 } });
    expect(fontPx(clamped, 11)).toBe(14);
  });
});

describe("title space", () => {
  it("기본 28, 부제목은 한 줄 더, 숨기면 8", () => {
    expect(headerHeight(DEFAULT_OPTIONS)).toBe(28);
    const sub = mergeOptions(DEFAULT_OPTIONS, { title: { subtitle: "부" } });
    expect(headerHeight(sub)).toBe(28 + 11 + 4);
    const hidden = mergeOptions(DEFAULT_OPTIONS, { title: { visible: false } });
    expect(headerHeight(hidden)).toBe(8);
  });
});

describe("point label", () => {
  it("소수 자리", () => {
    expect(formatValue(1234.5678, null)).toBe("1,234.57");
    expect(formatValue(3, 2)).toBe("3.00");
    expect(formatValue(2.5, 0)).toBe("3");
  });

  it("겹치는 글자 상자는 건너뛴다", () => {
    const guard = createLabelGuard();
    expect(guard.take({ x: 0, y: 0, width: 20, height: 10 })).toBe(true);
    expect(guard.take({ x: 10, y: 5, width: 20, height: 10 })).toBe(false);
    expect(guard.take({ x: 40, y: 0, width: 20, height: 10 })).toBe(true);
  });

  it("투명도 0이면 불투명", () => {
    expect(alphaOf(0)).toBe(1);
    expect(alphaOf(0.25)).toBe(0.75);
    expect(alphaOf(1.5)).toBe(0);
  });
});
