// heatmap·candle·gantt·treemap이 차트 속성(options)을 따르는지. 그리기 호출을 기록하는 가짜 canvas로 확인한다.

import { describe, expect, it } from "vitest";
import { renderCandle } from "./candle";
import { renderGantt } from "./gantt";
import { renderHeatmap, sequentialColor } from "./heatmap";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { renderTreemap } from "./treemap";

type Call = { name: string; args: unknown[]; fillStyle: unknown };

const GRADIENT = { addColorStop() {} };

/** 그리기 호출을 기록하는 가짜 canvas. 글자 하나를 7px로 잰다. */
function recorder(width = 400, height = 300) {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    canvas: { width, height },
  };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "measureText")
        return (text: string) => ({ width: text.length * 7 });
      if (key === "createLinearGradient") return () => GRADIENT;
      return (...args: unknown[]) => {
        calls.push({ name: key, args, fillStyle: target.fillStyle });
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  const texts = () =>
    calls.filter((c) => c.name === "fillText").map((c) => String(c.args[0]));
  return { ctx, calls, texts };
}

const opts = (patch: ChartOptionsPatch): ChartOptions =>
  mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
const noop = () => {};

const heatmapInput = {
  width: 400,
  height: 300,
  title: "item",
  xTitle: "x",
  yTitle: "y",
  xCategories: ["a", "b"],
  yCategories: ["p", "q"],
  cells: [
    [1, null],
    [3, 5],
  ],
  agg: "avg" as const,
  shapes: [],
};

const candles = {
  t: [0, 60_000, 120_000],
  open: [5, 4, 6],
  high: [9, 5, 8],
  low: [3, 2, 6],
  close: [3, 5, 7],
  count: [1, 1, 1],
};
const candleInput = {
  width: 400,
  height: 300,
  title: "item",
  interval: 60_000,
  candles,
  legend: {
    title: "캔들",
    values: ["상승", "하락"],
    colors: ["#e34948", "#2a78d6"],
  },
  shapes: [],
};

const ganttInput = {
  width: 400,
  height: 300,
  title: "item",
  rowTitle: "설비",
  rows: ["A", "B"],
  bars: {
    r: [0, 1],
    s: [0, 0],
    e: [3_600_000, 7_200_000],
    g: [0, 0],
    n: [1, 1],
  },
  color: "#2a78d6",
  shapes: [],
};

const treemapInput = {
  width: 400,
  height: 300,
  title: "item",
  categories: ["a", "b", "c"],
  bars: [[3], [1], [null]],
  agg: "sum" as const,
  color: "#2a78d6",
  shapes: [],
};

describe("기본 options는 options가 없을 때와 같이 그린다", () => {
  it.each([
    [
      "heatmap",
      (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
        renderHeatmap(ctx, { ...heatmapInput, options: o }, noop),
    ],
    [
      "candle",
      (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
        renderCandle(ctx, { ...candleInput, options: o }, noop),
    ],
    [
      "gantt",
      (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
        renderGantt(ctx, { ...ganttInput, options: o }, noop),
    ],
    [
      "treemap",
      (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
        renderTreemap(ctx, { ...treemapInput, options: o }, noop),
    ],
  ] as const)("%s", (_, render) => {
    const a = recorder();
    const b = recorder();
    const metaA = render(a.ctx);
    const metaB = render(b.ctx, DEFAULT_OPTIONS);
    expect(b.calls).toEqual(a.calls);
    expect(metaB).toEqual(metaA);
  });
});

describe("heatmap options", () => {
  it("빈 칸을 nullNumeric 값으로 채워 그리고 metadata도 채운다", () => {
    const { ctx } = recorder();
    const meta = renderHeatmap(
      ctx,
      { ...heatmapInput, options: opts({ value: { nullNumeric: 0 } }) },
      noop,
    );
    expect(meta.cells[0][1]).toBe(0);
    expect(meta.colorDomain).toEqual([0, 5]);
  });

  it("팔레트 그라데이션 단계로 칸 색을 끊어 칠한다", () => {
    const palette = {
      ...DEFAULT_OPTIONS.palette,
      gradient: true,
      start: "#000000",
      end: "#ffffff",
      steps: 2,
    };
    const color = sequentialColor([0, 10], palette);
    expect(color(1)).toBe("#000000");
    expect(color(9)).toBe("#ffffff");
    const reversed = sequentialColor([0, 10], { ...palette, reverse: true });
    expect(reversed(1)).toBe("#ffffff");
  });

  it("칸 값 글자를 앞뒤 글자와 함께 적는다", () => {
    const { ctx, texts } = recorder();
    renderHeatmap(
      ctx,
      {
        ...heatmapInput,
        options: opts({ pointLabel: { visible: true, suffix: "℃" } }),
      },
      noop,
    );
    expect(texts()).toContain("5℃");
  });
});

describe("candle options", () => {
  it("값 축 min·max를 쓰고, 확대 범위가 이긴다", () => {
    const options = opts({ axes: { y: { min: 0, max: 20 } } });
    const meta = renderCandle(
      recorder().ctx,
      { ...candleInput, options },
      noop,
    );
    expect(meta.y.domain).toEqual([0, 20]);
    const zoomed = renderCandle(
      recorder().ctx,
      { ...candleInput, options, view: { x: [0, 180_000], y: [4, 6] } },
      noop,
    );
    expect(zoomed.y.domain).toEqual([4, 6]);
  });

  it("focus 조건(종가 > 4)에 맞는 캔들을 focus 색으로 칠한다", () => {
    const { ctx, calls } = recorder();
    renderCandle(
      ctx,
      {
        ...candleInput,
        options: opts({
          focus: { enabled: true, target: "y", operator: ">", value: 4 },
        }),
      },
      noop,
    );
    const bodies = calls.filter((c) => c.name === "fillRect").slice(1);
    expect(bodies.map((c) => c.fillStyle)).toEqual([
      "#2a78d6",
      DEFAULT_OPTIONS.focus.color,
      DEFAULT_OPTIONS.focus.color,
    ]);
  });

  it("종가 글자를 소수 자리에 맞춰 적는다", () => {
    const { ctx, texts } = recorder();
    renderCandle(
      ctx,
      {
        ...candleInput,
        options: opts({ pointLabel: { visible: true, decimals: 1 } }),
      },
      noop,
    );
    expect(texts()).toEqual(expect.arrayContaining(["3.0", "5.0", "7.0"]));
  });
});

describe("gantt options", () => {
  it("focus y는 구간 길이(시간)로 견준다", () => {
    const { ctx, calls } = recorder();
    renderGantt(
      ctx,
      {
        ...ganttInput,
        options: opts({
          focus: { enabled: true, target: "y", operator: ">=", value: 2 },
        }),
      },
      noop,
    );
    const bars = calls.filter((c) => c.name === "fillRect").slice(1);
    expect(bars.map((c) => c.fillStyle)).toEqual([
      "#2a78d6",
      DEFAULT_OPTIONS.focus.color,
    ]);
  });

  it("테두리만(border) 모양이면 채우지 않고 테두리를 그린다", () => {
    const { ctx, calls } = recorder();
    renderGantt(
      ctx,
      { ...ganttInput, options: opts({ shape: { style: "border" } }) },
      noop,
    );
    expect(calls.filter((c) => c.name === "fillRect")).toHaveLength(1);
    expect(calls.filter((c) => c.name === "strokeRect")).toHaveLength(2);
  });

  it("제목을 숨기면 제목과 요약 글자를 그리지 않는다", () => {
    const { ctx, texts } = recorder();
    renderGantt(
      ctx,
      { ...ganttInput, options: opts({ title: { visible: false } }) },
      noop,
    );
    expect(texts()).not.toContain("item");
    expect(texts().some((t) => t.includes("개 행"))).toBe(false);
  });
});

describe("treemap options", () => {
  it("빈 값을 nullNumeric으로 채우면 칸이 생긴다", () => {
    const base = renderTreemap(recorder().ctx, treemapInput, noop);
    expect(base.leaves).toHaveLength(2);
    const filled = renderTreemap(
      recorder().ctx,
      { ...treemapInput, options: opts({ value: { nullNumeric: 2 } }) },
      noop,
    );
    expect(filled.leaves.map((l) => l.name).sort()).toEqual(["a", "b", "c"]);
  });

  it("값 글자를 켜면 앞 글자를 붙여 칸 가운데에 적는다", () => {
    const { ctx, texts } = recorder();
    renderTreemap(
      ctx,
      {
        ...treemapInput,
        options: opts({ pointLabel: { visible: true, prefix: "$" } }),
      },
      noop,
    );
    expect(texts()).toContain("$3");
  });
});
