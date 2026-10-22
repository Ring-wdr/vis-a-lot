import { describe, expect, it } from "vitest";
import {
  niceDomain,
  type ScatterInput,
  timeFormatter,
  withoutDeleted,
  xAxis,
} from "./scatter";

const input = (deletions: ScatterInput["deletions"]): ScatterInput => ({
  width: 100,
  height: 100,
  title: "t",
  xKind: "number",
  xs: Float64Array.from([1, 2, 3, 4]),
  ys: Float64Array.from([1, 2, 3, 4]),
  ids: Float64Array.from([10, 20, 30, 40]),
  color: "#000000",
  legend: {
    title: "g",
    values: ["a", "b"],
    colors: ["#000000", "#ffffff"],
    index: Uint8Array.from([0, 1, 0, 1]),
  },
  shapes: [],
  deletions,
});

describe("withoutDeleted", () => {
  it("지운 영역 안의 점을 행 id·legend와 함께 뺀다", () => {
    const out = withoutDeleted(
      input([{ type: "rect", x0: 1.5, y0: 1.5, x1: 3.5, y1: 3.5 }]),
    );
    expect([...out.xs]).toEqual([1, 4]);
    expect([...out.ids]).toEqual([10, 40]);
    expect([...(out.legend?.index ?? [])]).toEqual([0, 1]);
  });

  it("지운 영역이 없으면 입력을 그대로 쓴다", () => {
    const original = input(undefined);
    expect(withoutDeleted(original)).toBe(original);
  });
});

describe("xAxis", () => {
  const t = Date.UTC(2026, 8, 1);

  it("시계열을 1ms보다 좁게 확대해도 가운데 값이 가운데에 놓인다", () => {
    const { scale } = xAxis("time", [t - 0.3, t + 0.3], [0, 100], false);
    expect(scale(t)).toBeCloseTo(50);
  });

  it("시계열 눈금은 범위 안에만 두고, 없으면 가운데 하나", () => {
    const { ticks } = xAxis("time", [t + 0.1, t + 0.4], [0, 300], false);
    expect(ticks).toEqual([t + 0.25]);
  });
});

describe("niceDomain", () => {
  it("값이 하나뿐인 시계열은 앞뒤 1분을 보여준다", () => {
    expect(niceDomain(Float64Array.from([1000, 1000]), "time")).toEqual([
      -59_000, 61_000,
    ]);
  });
});

describe("timeFormatter", () => {
  it("좁은 범위는 초·밀리초까지 적는다", () => {
    const t = Date.UTC(2026, 8, 1, 0, 0, 1, 250) - 9 * 3_600_000;
    expect(timeFormatter([t, t + 60_000])(t)).toBe("00:00:01");
    expect(timeFormatter([t, t + 1_000])(t)).toBe("00:00:01.250");
  });
});
