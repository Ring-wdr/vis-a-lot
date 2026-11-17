// 점 모양: PNG 점과 legend 색 표시가 같은 모양인지. path 꼭짓점을 기록하는 가짜 canvas로 확인한다.

import { describe, expect, it } from "vitest";
import {
  type ChartOptions,
  DEFAULT_OPTIONS,
  mergeOptions,
  type PointShape,
} from "./options";
import { renderScatter, type ScatterInput } from "./scatter";
import { pathPoint, SHAPE_VERTICES } from "./style";

type Path = { points: [number, number][]; closed: boolean };

/** beginPath부터 fill·stroke까지의 꼭짓점을 path 하나로 모으는 가짜 canvas */
function pathRecorder() {
  const paths: Path[] = [];
  let current: Path = { points: [], closed: false };
  const state: Record<string, unknown> = {
    font: "",
    canvas: { width: 400, height: 300 },
  };
  const methods: Record<string, unknown> = {
    measureText: (t: string) => ({ width: t.length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    beginPath: () => {
      current = { points: [], closed: false };
    },
    moveTo: (x: number, y: number) => current.points.push([x, y]),
    lineTo: (x: number, y: number) => current.points.push([x, y]),
    closePath: () => {
      current.closed = true;
    },
    fill: () => {
      if (current.points.length > 0) paths.push(current);
    },
    stroke: () => {
      if (current.points.length > 0) paths.push(current);
    },
  };
  const ctx = new Proxy(state, {
    get: (t, key: string) => (key in methods ? methods[key] : (t[key] ?? noop)),
    set: (t, key: string, value) => {
      t[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, paths };
}

const noop = () => {};

/** 가운데·크기를 지운 꼭짓점 (가운데 0, 가장 먼 꼭짓점 거리 1) */
function normalize(points: [number, number][]) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const r = Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return points.map(([x, y]) => [
    Math.round(((x - cx) / r) * 100) / 100 + 0,
    Math.round(((y - cy) / r) * 100) / 100 + 0,
  ]);
}

const POLYGONS = Object.keys(SHAPE_VERTICES) as (keyof typeof SHAPE_VERTICES)[];

describe("pathPoint 새 모양", () => {
  it("꼭짓점 수와 닫힌 path", () => {
    const counts = {
      downTriangle: 3,
      leftTriangle: 3,
      rightTriangle: 3,
      hexagon: 6,
      star: 10,
    };
    for (const shape of POLYGONS) {
      const { ctx, paths } = pathRecorder();
      ctx.beginPath();
      pathPoint(ctx, shape, 50, 50, 4);
      ctx.fill();
      expect(paths[0].closed).toBe(true);
      expect(paths[0].points).toHaveLength(counts[shape]);
      // 모든 꼭짓점이 반지름 안에 있다.
      for (const [x, y] of paths[0].points) {
        expect(Math.hypot(x - 50, y - 50)).toBeLessThanOrEqual(4 + 1e-9);
      }
    }
  });

  it("세모의 뾰족한 쪽: 아래·왼쪽·오른쪽", () => {
    const tip = (shape: PointShape) => {
      const { ctx, paths } = pathRecorder();
      ctx.beginPath();
      pathPoint(ctx, shape, 0, 0, 1);
      ctx.fill();
      return paths[0].points[0].map((v) => Math.round(v * 1000) / 1000 + 0);
    };
    expect(tip("downTriangle")).toEqual([0, 1]);
    expect(tip("leftTriangle")).toEqual([-1, 0]);
    expect(tip("rightTriangle")).toEqual([1, 0]);
  });
});

describe("scatter 점과 legend 표시", () => {
  const input = (shape: PointShape): ScatterInput => ({
    options: mergeOptions<ChartOptions>(DEFAULT_OPTIONS, {
      shape: { type: shape },
    }),
    width: 400,
    height: 300,
    title: "item",
    xKind: "number",
    xs: Float64Array.from([1, 5, 9]),
    ys: Float64Array.from([2, 6, 4]),
    ids: Float64Array.from([0, 1, 2]),
    color: "#2a78d6",
    legend: {
      title: "g",
      values: ["a", "b"],
      colors: ["#2a78d6", "#eb6834"],
      hidden: ["b"],
      index: Uint8Array.from([0, 0, 1]),
    },
    shapes: [],
  });

  it.each(POLYGONS)("%s: PNG 점과 legend 색 표시가 같은 모양", (shape) => {
    const { ctx, paths } = pathRecorder();
    const meta = renderScatter(ctx, input(shape), noop);
    const n = SHAPE_VERTICES[shape].length;
    const marks = paths.filter((p) => p.closed && p.points.length === n);
    // 점 둘(끈 b의 점은 그리지 않는다) + legend 표시 둘(켠 a는 채우고, 끈 b는 테두리만)
    expect(marks).toHaveLength(4);
    const want = normalize(marks[0].points);
    for (const m of marks) expect(normalize(m.points)).toEqual(want);
    // 화면이 legend를 같은 모양으로 다시 그릴 수 있게 metadata에 모양을 남긴다.
    expect(meta.legend?.layout?.shape).toBe(shape);
    expect(meta.shape).toBe(shape);
  });

  it("기본 원이면 metadata에 모양을 남기지 않는다", () => {
    const { ctx } = pathRecorder();
    const meta = renderScatter(ctx, input("circle"), noop);
    expect(meta.legend?.layout).not.toHaveProperty("shape");
    expect(meta).not.toHaveProperty("shape");
  });

  it("섬네일도 같은 모양으로 그린다", () => {
    const { ctx, paths } = pathRecorder();
    renderScatter(ctx, { ...input("star"), compact: true }, noop);
    expect(
      paths.filter((p) => p.closed && p.points.length === 10),
    ).toHaveLength(2);
  });
});
