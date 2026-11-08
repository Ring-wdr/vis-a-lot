import { describe, expect, it } from "vitest";
import {
  createWheelAccumulator,
  MIN_THUMB_PX,
  pageAt,
  thumbSize,
  thumbTop,
} from "./page-scroll";

describe("page scroll geometry", () => {
  it("thumb 길이는 한 페이지 비율, 최소 길이 보장, 페이지가 하나면 트랙 전체", () => {
    expect(thumbSize(400, 4)).toBe(100);
    expect(thumbSize(400, 1000)).toBe(MIN_THUMB_PX);
    expect(thumbSize(400, 1)).toBe(400);
  });

  it("페이지 ↔ thumb 위치가 서로 맞는다", () => {
    const track = 400;
    const total = 120;
    const thumb = thumbSize(track, total);
    expect(thumbTop(track, thumb, 0, total)).toBe(0);
    expect(thumbTop(track, thumb, total - 1, total)).toBe(track - thumb);
    for (const page of [0, 1, 37, 60, 119]) {
      expect(
        pageAt(track, thumb, thumbTop(track, thumb, page, total), total),
      ).toBe(page);
    }
  });

  it("트랙 밖 위치는 처음/마지막 페이지로", () => {
    expect(pageAt(400, 20, -50, 10)).toBe(0);
    expect(pageAt(400, 20, 999, 10)).toBe(9);
  });
});

describe("wheel accumulator", () => {
  it("잘게 오는 값은 모아서 한 페이지", () => {
    const wheel = createWheelAccumulator(100);
    expect([30, 30, 30, 30].map(wheel)).toEqual([0, 0, 0, 1]);
  });

  it("크게 굴리면 여러 페이지, 방향이 바뀌면 다시 센다", () => {
    const wheel = createWheelAccumulator(100);
    expect(wheel(350)).toBe(3);
    expect(wheel(-40)).toBe(0);
    expect(wheel(-60)).toBe(-1);
  });
});
