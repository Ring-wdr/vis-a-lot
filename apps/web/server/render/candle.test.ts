import { describe, expect, it } from "vitest";
import { candleExtent, candlePoint, intervalLabel } from "./candle";

const candles = {
  t: [0, 1000, 2000],
  open: [5, 4, 6],
  high: [9, 4, 8],
  low: [3, 2, 6],
  close: [3, 4, 7],
  count: [3, 1, 2],
};

describe("candle", () => {
  it("대표점은 구간 가운데 시각과 종가다", () => {
    expect(candlePoint(candles, 1000, 1)).toEqual([1500, 4]);
  });

  it("전체 범위는 첫 구간 시작~마지막 구간 끝, 저가 최소~고가 최대다", () => {
    expect(candleExtent(candles, 1000)).toEqual({ x: [0, 3000], y: [2, 9] });
  });

  it("구간 길이를 단위로 읽는다", () => {
    expect(intervalLabel(5 * 60_000)).toBe("5분");
    expect(intervalLabel(2 * 3_600_000)).toBe("2시간");
    expect(intervalLabel(86_400_000)).toBe("1일");
    expect(intervalLabel(15_000)).toBe("15초");
  });
});
