// scatter 집계 루프가 d3 scale 대신 쓰는 풀어 쓴 선형 식(linearOf·atLinear)이 d3와 비트 단위로 같은지.

import { scaleLinear } from "d3-scale";
import { describe, expect, it } from "vitest";
import { createRandom } from "../data/random";
import { valueScale } from "./axis-style";
import { atLinear, linearOf, xAxis } from "./scatter";

const r = createRandom(20261108);

/** 도메인 안·밖·끝값·같은 값 등 섞은 값 */
function samples(d0: number, d1: number) {
  const span = d1 - d0;
  const out = [d0, d1, (d0 + d1) / 2, 0, -0, Number.NaN];
  for (let k = 0; k < 200; k++) out.push(d0 + span * (r.next() * 3 - 1));
  return out;
}

function expectSame(
  scale: ((v: number) => number) & {
    domain(): number[];
    range(): number[];
  },
  values: number[],
) {
  const m = linearOf(scale);
  expect(m).toBeDefined();
  if (!m) return;
  for (const v of values) {
    const want = scale(v) ?? Number.NaN;
    expect(Object.is(atLinear(m, v), want) || atLinear(m, v) === want).toBe(
      true,
    );
  }
}

describe("linearOf · atLinear", () => {
  it("무작위 도메인·범위 (뒤집힌 범위 포함)", () => {
    for (let k = 0; k < 200; k++) {
      const d0 = (r.next() - 0.5) * 10 ** r.int(-3, 13);
      const d1 = d0 + r.next() * 10 ** r.int(-3, 13);
      const r0 = r.range(0, 500);
      const r1 = r.next() < 0.5 ? r0 + r.range(1, 900) : r0 - r.range(1, 900);
      expectSame(
        scaleLinear().domain([d0, d1]).range([r0, r1]),
        samples(d0, d1),
      );
    }
  });

  it("내림차순 도메인은 d3처럼 뒤집어 계산한다", () => {
    for (let k = 0; k < 50; k++) {
      const d1 = r.range(-1e6, 1e6);
      const d0 = d1 + r.range(1e-3, 1e6);
      expectSame(
        scaleLinear().domain([d0, d1]).range([30, 410]),
        samples(d1, d0),
      );
    }
  });

  it("범위가 0인 도메인은 가운데 (d3 0.5), nice를 건 scale도 같다", () => {
    expectSame(scaleLinear().domain([5, 5]).range([0, 100]), [
      5,
      1,
      9,
      Number.NaN,
    ]);
    const nice = scaleLinear().domain([0.013, 97.2]).range([400, 20]).nice(7);
    expectSame(nice, samples(0, 100));
  });

  it("clamp를 걸었거나 칸이 셋 이상이면 쓰지 않는다", () => {
    expect(linearOf(scaleLinear().domain([0, 1]).clamp(true))).toBeUndefined();
    expect(
      linearOf(scaleLinear().domain([0, 1, 2]).range([0, 5, 10])),
    ).toBeUndefined();
  });

  it("축 함수가 만드는 scale과 같다 (숫자·시계열 x, 확대 y)", () => {
    const t0 = Date.UTC(2026, 0, 1);
    const t1 = Date.UTC(2026, 11, 31, 23, 59, 59, 999);
    for (const kind of ["number", "time"] as const) {
      const d: [number, number] = kind === "time" ? [t0, t1] : [-3.7, 1234.5];
      for (const nice of [true, false]) {
        const { scale, log } = xAxis(kind, d, [48, 768], nice);
        expect(log).toBe(false);
        expectSame(scale, samples(d[0], d[1]));
      }
    }
    const y = valueScale([-12.3, 88.8], [412, 32], undefined, { zoomed: true });
    expectSame(y.scale, samples(-12.3, 88.8));
  });
});
