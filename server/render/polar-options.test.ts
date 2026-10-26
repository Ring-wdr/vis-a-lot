// pie · radar · funnel · sankey가 차트 속성(options)을 그리는지. 그리기 호출을 기록하는 가짜 canvas로 확인한다.

import { describe, expect, it } from "vitest";
import { chartTypeDefaults } from "@/entities/chart/model/chart-options";
import { CHART_DEFAULTS } from "../charts/chart-defaults";
import { resolveOptions } from "../charts/chart-options";
import { renderFunnel } from "./funnel";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { renderPie } from "./pie";
import { renderRadar } from "./radar";
import { renderSankey } from "./sankey";

type Call = [string, ...unknown[]];

/** 메서드 호출과 속성 대입을 순서대로 남기는 가짜 canvas. 글자 하나를 7px로 잰다. */
function recorder() {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {
    canvas: { width: 400, height: 300 },
    measureText: (text: string) => ({ width: text.length * 7 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  const ctx = new Proxy(target, {
    get: (t, key: string) => {
      if (key in t && typeof t[key] !== "function") return t[key];
      return (...args: unknown[]) => {
        calls.push([key, ...args]);
        return typeof t[key] === "function"
          ? (t[key] as (...a: unknown[]) => unknown)(...args)
          : undefined;
      };
    },
    set: (t, key: string, value) => {
      calls.push([`=${key}`, value]);
      t[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, calls };
}

const noop = () => {};
const opts = (patch: ChartOptionsPatch): ChartOptions =>
  mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
const texts = (calls: Call[]) =>
  calls.filter((c) => c[0] === "fillText").map((c) => String(c[1]));

const legend = {
  title: "범주",
  values: ["a", "b", "c"],
  colors: ["#2a78d6", "#eb6834", "#1baf7a"],
};

const pieInput = {
  width: 400,
  height: 300,
  title: "item",
  slices: [
    { category: "a", value: 60 },
    { category: "b", value: 30 },
    { category: "c", value: 10 },
  ],
  legend,
};

const radarInput = {
  width: 400,
  height: 300,
  title: "item",
  axisTitle: "축",
  axes: ["p", "q", "r", "s"],
  cells: [
    [1, 2],
    [3, null],
    [5, 6],
    [7, 8],
  ],
  color: "#2a78d6",
  seriesName: "값",
  legend: { ...legend, values: ["a", "b"], colors: legend.colors.slice(0, 2) },
};

const funnelInput = {
  width: 400,
  height: 300,
  title: "item",
  stages: ["s1", "s2", "s3"],
  values: [100, null, 40],
  color: "#2a78d6",
  legend: {
    ...legend,
    values: ["s1", "s2", "s3"],
  },
  shapes: [],
};

const sankeyInput = {
  width: 400,
  height: 300,
  title: "item",
  sources: ["A", "B"],
  targets: ["x", "y"],
  links: [
    { source: 0, target: 0, value: 6 },
    { source: 1, target: 1, value: 2 },
    { source: 1, target: 0, value: 0.001 },
  ],
  agg: "sum" as const,
  legend: { ...legend, values: ["A", "B"], colors: legend.colors.slice(0, 2) },
  shapes: [],
};

const RENDERERS = {
  pie: (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
    renderPie(ctx, { ...pieInput, options: o }, noop),
  radar: (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
    renderRadar(ctx, { ...radarInput, options: o }, noop),
  funnel: (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
    renderFunnel(ctx, { ...funnelInput, options: o }, noop),
  sankey: (ctx: OffscreenCanvasRenderingContext2D, o?: ChartOptions) =>
    renderSankey(ctx, { ...sankeyInput, options: o }, noop),
};

describe.each(Object.entries(RENDERERS))("%s 속성", (_name, render) => {
  it("기본값이면 옵션이 없을 때와 같은 그리기·metadata", () => {
    const a = recorder();
    const b = recorder();
    const metaA = render(a.ctx);
    const metaB = render(b.ctx, DEFAULT_OPTIONS);
    expect(b.calls).toEqual(a.calls);
    expect(metaB).toEqual(metaA);
  });

  it("panel 배경색, 제목 글자·숨김, legend 숨김", () => {
    const { ctx, calls } = recorder();
    const meta = render(
      ctx,
      opts({
        panel: { backColor: "#101010" },
        title: { text: "새 제목" },
        legend: { visible: false },
      }),
    );
    expect(calls.find((c) => c[0] === "=fillStyle")?.[1]).toBe("#101010");
    expect(texts(calls)).toContain("새 제목");
    expect(meta.legend?.entries ?? []).toEqual([]);

    const hidden = recorder();
    render(hidden.ctx, opts({ title: { visible: false } }));
    expect(texts(hidden.calls)).not.toContain("item");
  });

  it("투명도는 globalAlpha로 간다", () => {
    const { ctx, calls } = recorder();
    render(ctx, opts({ shape: { transparency: 0.5 } }));
    const alphas = calls
      .filter((c) => c[0] === "=globalAlpha")
      .map((c) => c[1]);
    expect(alphas.some((a) => typeof a === "number" && a > 0 && a < 1)).toBe(
      true,
    );
  });
});

describe("pie 점 글자", () => {
  it("켜면 비율 대신 조각 값을 앞뒤 글자·소수 자리와 함께 적는다", () => {
    const { ctx, calls } = recorder();
    renderPie(
      ctx,
      {
        ...pieInput,
        options: opts({
          pointLabel: { visible: true, prefix: "₩", suffix: "개", decimals: 1 },
        }),
      },
      noop,
    );
    const t = texts(calls);
    expect(t).toContain("₩60.0개");
    expect(t).not.toContain("60%");
  });

  it("border 모양은 조각을 채우지 않고 조각 색으로 테두리만", () => {
    const { ctx, calls } = recorder();
    renderPie(
      ctx,
      { ...pieInput, options: opts({ shape: { style: "border" } }) },
      noop,
    );
    const strokes = calls
      .filter((c) => c[0] === "=strokeStyle")
      .map((c) => c[1]);
    expect(strokes).toEqual(expect.arrayContaining(legend.colors));
  });
});

describe("radar", () => {
  it("빈 칸은 value.nullNumeric으로 채워 꼭짓점을 그린다", () => {
    const empty = recorder();
    const before = renderRadar(empty.ctx, radarInput, noop);
    expect(before.series[1].points[1]).toBeNull();
    const { ctx } = recorder();
    const meta = renderRadar(
      ctx,
      { ...radarInput, options: opts({ value: { nullNumeric: 0 } }) },
      noop,
    );
    expect(meta.series[1].values[1]).toBe(0);
    expect(meta.series[1].points[1]).not.toBeNull();
  });

  it("꼭짓점 모양·선 굵기", () => {
    const { ctx, calls } = recorder();
    renderRadar(
      ctx,
      {
        ...radarInput,
        options: opts({ shape: { type: "square" }, size: { lineWidth: 4 } }),
      },
      noop,
    );
    expect(calls.some((c) => c[0] === "rect")).toBe(true);
    expect(calls.some((c) => c[0] === "=lineWidth" && c[1] === 4)).toBe(true);
  });

  it("radar 선 굵기 기본값(2)은 draw와 설정 창 기준이 같은 값이다", () => {
    const widthsOf = (options: ChartOptions) => {
      const { ctx, calls } = recorder();
      renderRadar(ctx, { ...radarInput, options }, noop);
      return calls.filter((c) => c[0] === "=lineWidth").map((c) => c[1]);
    };
    const drawn = resolveOptions("radar", undefined, undefined);
    expect(drawn.size.lineWidth).toBe(2);
    // 계열 다각형 선만 굵기가 바뀐다. 차트 종류별 값이 없으면 전체 기본값(1.5)으로 그린다.
    const count = (widths: unknown[], w: number) =>
      widths.filter((x) => x === w).length;
    const radar = widthsOf(drawn);
    const global = widthsOf(DEFAULT_OPTIONS);
    expect(count(radar, 2)).toBeGreaterThan(count(global, 2));
    // 설정 창은 같은 기본값을 기준으로 보여 주고 되돌린다.
    expect(chartTypeDefaults(CHART_DEFAULTS, "radar").options).toEqual(drawn);
    // 공통 속성으로 바꾸면 그 굵기
    expect(
      resolveOptions("radar", { size: { lineWidth: 1.5 } }, undefined).size
        .lineWidth,
    ).toBe(1.5);
  });
});

describe("funnel", () => {
  it("값이 없는 단계는 value.nullNumeric으로 그린다", () => {
    const { ctx } = recorder();
    const meta = renderFunnel(
      ctx,
      { ...funnelInput, options: opts({ value: { nullNumeric: 70 } }) },
      noop,
    );
    expect(meta.stages.map((s) => s.value)).toEqual([100, 70, 40]);
  });
});

describe("sankey", () => {
  it("가장 가는 흐름도 size.lineWidth 굵기로 그린다", () => {
    const { ctx, calls } = recorder();
    renderSankey(
      ctx,
      { ...sankeyInput, options: opts({ size: { lineWidth: 9 } }) },
      noop,
    );
    const widths = calls
      .filter((c) => c[0] === "=lineWidth")
      .map((c) => c[1] as number);
    expect(widths).toContain(9);
  });
});
