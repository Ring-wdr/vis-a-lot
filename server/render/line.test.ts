import { describe, expect, it } from "vitest";
import { createRandom } from "../data/random";
import { m4, runsOf, seriesOrder, sortedByValue } from "./line";

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

// ── 바꾸기 전 구현과 같은지 ─────────────────────────────────────

/** 바꾸기 전 seriesOrder의 정렬 */
function compareSort(xs: ArrayLike<number>, order: Int32Array) {
  order.sort((a, b) => xs[a] - xs[b] || a - b);
}

/** 바꾸기 전 m4 */
function m4Reference(
  order: ArrayLike<number>,
  from: number,
  to: number,
  sx: ArrayLike<number>,
  sy: ArrayLike<number>,
  range: [number, number],
): number[] {
  const out: number[] = [];
  const lo = Math.floor(range[0]) - 1;
  const hi = Math.ceil(range[1]) + 1;
  let column = Number.NaN;
  let first = -1;
  let min = -1;
  let max = -1;
  let last = -1;
  const flush = () => {
    if (first === -1) return;
    const picks = [first, min, max, last].sort((a, b) => a - b);
    for (let k = 0; k < picks.length; k++) {
      if (k === 0 || picks[k] !== picks[k - 1]) out.push(order[picks[k]]);
    }
  };
  for (let k = from; k < to; k++) {
    const i = order[k];
    const c = Math.min(hi, Math.max(lo, Math.floor(sx[i])));
    if (c !== column) {
      flush();
      column = c;
      first = min = max = last = k;
      continue;
    }
    if (sy[i] < sy[order[min]]) min = k;
    if (sy[i] > sy[order[max]]) max = k;
    last = k;
  }
  flush();
  return out;
}

/** 시각 비슷한 x(정렬 안 됨, 10%는 앞 값과 같음)와 랜덤 워크 y */
function randomPoints(n: number, seed: number) {
  const r = createRandom(seed);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let walk = 0;
  for (let i = 0; i < n; i++) {
    xs[i] =
      i > 0 && r.next() < 0.1
        ? xs[i - 1]
        : Date.UTC(2026, 0, 1) + Math.floor(r.next() * 365 * 86_400_000);
    walk += r.normal();
    ys[i] = walk;
  }
  return { xs, ys };
}

const identity = (n: number) => Int32Array.from({ length: n }, (_, i) => i);

describe("sortedByValue", () => {
  for (const n of [0, 1, 2, 3, 100, 20_000]) {
    it(`n=${n}: 비교 함수 정렬과 같다`, () => {
      const { xs } = randomPoints(n, n + 1);
      const expected = identity(n);
      compareSort(xs, expected);
      expect(sortedByValue(xs, identity(n))).toEqual(expected);
    });
  }

  it("음수·-0·무한·작은 값, 일부 행만 고른 order", () => {
    const xs = Float64Array.of(
      3,
      -0,
      0,
      -2.5,
      3,
      1e300,
      -1e-300,
      Infinity,
      -Infinity,
      0,
      5e-324,
    );
    // seriesOrder처럼 행 번호가 오름차순인 일부 (빠진 행이 있다)
    const order = Int32Array.of(0, 1, 2, 3, 5, 6, 7, 8, 9, 10);
    const expected = order.slice();
    compareSort(xs, expected);
    expect(sortedByValue(xs, order)).toEqual(expected);
  });

  it("NaN은 맨 뒤로 보낸다", () => {
    const xs = Float64Array.of(2, Number.NaN, 1, -Number.NaN);
    expect([...sortedByValue(xs, identity(4))]).toEqual([2, 0, 1, 3]);
  });

  it("넘긴 order는 바꾸지 않고 새 배열을 돌려준다", () => {
    const xs = Float64Array.of(3, 1, 2);
    for (const order of [identity(3), identity(1), identity(0)]) {
      const before = order.slice();
      const sorted = sortedByValue(xs, order);
      expect(order).toEqual(before);
      expect(sorted).not.toBe(order);
    }
    expect([...sortedByValue(xs, [0, 1, 2])]).toEqual([1, 2, 0]);
  });

  it("seriesOrder가 계열마다 같은 결과를 낸다", () => {
    const { xs } = randomPoints(5000, 9);
    const g = Uint8Array.from(xs, (_, i) => i % 3);
    const series = seriesOrder(xs, g, 3);
    for (let k = 0; k < 3; k++) {
      const expected = Int32Array.from(
        [...identity(5000)].filter((i) => g[i] === k),
      );
      compareSort(xs, expected);
      expect(series[k]).toEqual(expected);
    }
  });
});

describe("m4 (바꾸기 전과 같은지)", () => {
  for (const n of [0, 1, 2, 7, 1000, 50_000]) {
    it(`n=${n}`, () => {
      const { xs, ys } = randomPoints(n, n + 3);
      const order = sortedByValue(xs, identity(n));
      // 800px 폭에 펴고, 일부는 그림 영역 밖으로
      const [x0, x1] = [Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1)];
      const sx = Float32Array.from(
        xs,
        (v) => -40 + ((v - x0) / (x1 - x0)) * 880,
      );
      const sy = Float32Array.from(ys);
      const from = Math.min(n, 2);
      const to = Math.max(from, n - 1);
      expect(m4(order, from, to, sx, sy, [0, 800])).toEqual(
        m4Reference(order, from, to, sx, sy, [0, 800]),
      );
    });
  }

  it("같은 y·NaN 좌표", () => {
    const sx = [0.1, 0.2, 0.3, Number.NaN, 1.2, 1.3, 1.4];
    const sy = [1, 1, 1, 2, Number.NaN, 3, 3];
    const order = [0, 1, 2, 3, 4, 5, 6];
    expect(m4(order, 0, 7, sx, sy, [0, 10])).toEqual(
      m4Reference(order, 0, 7, sx, sy, [0, 10]),
    );
  });
});
