import { describe, expect, it } from "vitest";
import { m4, runsOf, seriesOrder } from "./line";

describe("seriesOrder", () => {
  it("legend 계열별로 나눠 x 순으로 정렬하고, x가 같으면 원래 순서를 지킨다", () => {
    const xs = Float64Array.from([3, 1, 2, 1, 5]);
    const g = Uint8Array.from([0, 0, 1, 0, 1]);
    const [a, b] = seriesOrder(xs, g, 2);
    expect([...a]).toEqual([1, 3, 0]);
    expect([...b]).toEqual([2, 4]);
  });

  it("legend가 없으면 계열 하나, 끈 계열은 비운다", () => {
    const xs = Float64Array.from([2, 1]);
    expect([...seriesOrder(xs, undefined, 1)[0]]).toEqual([1, 0]);
    const off = seriesOrder(xs, Uint8Array.from([0, 1]), 2, [false, true]);
    expect([...off[1]]).toEqual([]);
  });
});

describe("m4", () => {
  it("픽셀 열마다 첫 점·최솟값·최댓값·끝 점만 x 순으로 남긴다", () => {
    // 열 0: 점 0~4, 열 1: 점 5
    const sx = [0.1, 0.2, 0.3, 0.4, 0.9, 1.5];
    const sy = [5, 9, 1, 7, 6, 3];
    const order = [0, 1, 2, 3, 4, 5];
    expect(m4(order, 0, 6, sx, sy, [0, 10])).toEqual([0, 1, 2, 4, 5]);
  });

  it("그림 영역 밖의 점은 양쪽 바깥 한 열에 모은다", () => {
    const sx = [-50, -20, 5, 200, 300];
    const sy = [1, 2, 3, 4, 5];
    const picks = m4([0, 1, 2, 3, 4], 0, 5, sx, sy, [0, 100]);
    expect(picks).toEqual([0, 1, 2, 3, 4]);
    const many = Array.from({ length: 100 }, (_, i) => -1000 + i);
    const ys = many.map((_, i) => i % 7);
    // 왼쪽 바깥 100점이 한 열로 줄어 넷 이하만 남는다.
    expect(
      m4(
        many.map((_, i) => i),
        0,
        100,
        many,
        ys,
        [0, 100],
      ).length,
    ).toBeLessThanOrEqual(4);
  });
});

describe("runsOf", () => {
  it("선택 안 점이 이어지는 구간만 돌려준다", () => {
    const order = [3, 0, 1, 2];
    const keep = Uint8Array.from([1, 0, 1, 1]);
    // x 순: 3(1), 0(1), 1(0), 2(1)
    expect(runsOf(order, keep)).toEqual([
      [0, 2],
      [3, 4],
    ]);
    expect(runsOf(order, undefined)).toEqual([[0, 4]]);
    expect(runsOf([], undefined)).toEqual([]);
  });
});
