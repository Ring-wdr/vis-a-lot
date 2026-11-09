import { describe, expect, it } from "vitest";
import type { BoxStats } from "../data/category-data";
import {
  applyValueOptions,
  type CategoryInput,
  renderCategory,
  stackSegments,
} from "./category";
import { renderHistogram } from "./histogram";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { renderWaterfall } from "./waterfall";

type Call = { op: string; args: unknown[]; state: Record<string, unknown> };

/** 그리기 호출을 그때의 fillStyle·globalAlpha와 함께 기록하는 가짜 canvas */
function recorder(width = 400, height = 300) {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    canvas: { width, height },
  };
  const methods: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key in methods) return methods[key];
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push({ op: key, args, state: { ...target } });
      };
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, calls };
}

const noop = () => {};
const opts = (patch: ChartOptionsPatch): ChartOptions =>
  mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
const texts = (calls: Call[]) =>
  calls.filter((c) => c.op === "fillText").map((c) => String(c.args[0]));

const bar = (patch?: ChartOptionsPatch): CategoryInput => ({
  options: patch && opts(patch),
  chartType: "bar",
  width: 400,
  height: 300,
  title: "t",
  categories: ["a", "b", "c"],
  bars: [[10], [null], [30]],
  agg: "avg",
  color: "#2a78d6",
  shapes: [],
});

const box = (v: number, outliers: number[]): BoxStats => ({
  n: 10,
  mean: v,
  q1: v - 1,
  median: v,
  q3: v + 1,
  lo: v - 2,
  hi: v + 2,
  outlierCount: outliers.length,
  outliers,
});

describe("bar 속성", () => {
  it("기본값을 넘겨도 넘기지 않은 것과 같은 그림·metadata", () => {
    const a = recorder();
    const b = recorder();
    const metaA = renderCategory(a.ctx, bar(), noop);
    const metaB = renderCategory(b.ctx, bar({}), noop);
    expect(metaB).toEqual(metaA);
    expect(b.calls).toEqual(a.calls);
  });

  it("value·expression: 빈 칸은 nullNumeric, y 식은 막대 값에 적용", () => {
    const out = applyValueOptions(
      bar({ value: { nullNumeric: 5 }, expression: { y: "y * 2 + x" } }),
    );
    // x는 범주 인덱스
    expect(out.bars).toEqual([[20], [11], [62]]);
  });

  it("value.outlier: 범위 밖 막대를 뺀다", () => {
    const input = {
      ...bar({ value: { outlier: true, outlierMethod: "sigma", outlierK: 1 } }),
      bars: [[10], [11], [9], [10], [100]],
      categories: ["a", "b", "c", "d", "e"],
    };
    expect(applyValueOptions(input).bars?.[4]).toEqual([null]);
  });

  it("y축 min·max로 범위를 고정하고, 확대가 있으면 확대 범위가 이긴다", () => {
    const fixed = renderCategory(
      recorder().ctx,
      bar({ axes: { y: { min: 0, max: 100 } } }),
      noop,
    );
    expect(fixed.y.domain).toEqual([0, 100]);
    const zoomed = renderCategory(
      recorder().ctx,
      {
        ...bar({ axes: { y: { min: 0, max: 100 } } }),
        view: { x: [-0.5, 2.5], y: [5, 15] },
      },
      noop,
    );
    expect(zoomed.y.domain).toEqual([5, 15]);
  });

  it("focus: 조건에 맞는 막대만 focus 색, legendSingleColor면 나머지는 회색", () => {
    const { ctx, calls } = recorder();
    renderCategory(
      ctx,
      bar({
        focus: {
          enabled: true,
          target: "y",
          operator: ">",
          value: 20,
          color: "#ff0000",
          legendSingleColor: true,
        },
      }),
      noop,
    );
    const fills = calls
      .filter((c) => c.op === "fill")
      .map((c) => c.state.fillStyle);
    expect(fills).toContain("#ff0000");
    expect(fills).toContain("#a9a8a2");
    expect(fills).not.toContain("#2a78d6");
  });

  it("pointLabel: 막대 끝 값에 앞뒤 글자를 붙여 단다", () => {
    const { ctx, calls } = recorder();
    renderCategory(
      ctx,
      bar({ pointLabel: { visible: true, suffix: "개", decimals: 1 } }),
      noop,
    );
    expect(texts(calls)).toEqual(expect.arrayContaining(["10.0개", "30.0개"]));
  });

  it("shape: border는 채우지 않고 테두리만, 투명도는 globalAlpha", () => {
    const { ctx, calls } = recorder();
    renderCategory(
      ctx,
      bar({ shape: { style: "border", transparency: 0.5, borderWidth: 2 } }),
      noop,
    );
    const roundRects = calls.filter((c) => c.op === "roundRect");
    expect(roundRects).toHaveLength(2);
    const strokes = calls.filter(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#2a78d6",
    );
    expect(strokes).toHaveLength(2);
    expect(strokes[0].state.globalAlpha).toBe(0.5);
    expect(strokes[0].state.lineWidth).toBe(2);
  });

  it("title·panel: 제목 글자와 배경색", () => {
    const { ctx, calls } = recorder();
    renderCategory(
      ctx,
      bar({
        title: { text: "매출", subtitle: "월별" },
        panel: { backColor: "#000000" },
      }),
      noop,
    );
    expect(texts(calls)).toEqual(expect.arrayContaining(["매출", "월별"]));
    const first = calls.find((c) => c.op === "fillRect");
    expect(first?.state.fillStyle).toBe("#000000");
  });

  it("legend.visible이 꺼지면 legend 항목이 없다", () => {
    const meta = renderCategory(
      recorder().ctx,
      {
        ...bar({ legend: { visible: false } }),
        bars: [[1, 2]],
        categories: ["a"],
        legend: {
          title: "g",
          values: ["x", "y"],
          colors: ["#000000", "#111111"],
        },
      },
      noop,
    );
    expect(meta.legend?.entries).toEqual([]);
  });
});

describe("boxplot 속성", () => {
  const input = (patch?: ChartOptionsPatch): CategoryInput => ({
    options: patch && opts(patch),
    chartType: "boxplot",
    width: 400,
    height: 300,
    title: "t",
    categories: ["a", "b"],
    boxes: [[box(10, [30])], [box(12, [])]],
    color: "#2a78d6",
    shapes: [],
  });

  it("value.outlier를 켜면 이상치 점을 빼고 축도 그 범위로 맞춘다", () => {
    const shown = renderCategory(recorder().ctx, input(), noop);
    const hidden = renderCategory(
      recorder().ctx,
      input({ value: { outlier: true } }),
      noop,
    );
    expect(shown.y.domain[1]).toBeGreaterThanOrEqual(30);
    expect(hidden.y.domain[1]).toBeLessThan(30);
  });

  it("shape.type이 이상치 점 모양, pointLabel은 중앙값", () => {
    const { ctx, calls } = recorder();
    renderCategory(
      ctx,
      input({ shape: { type: "square" }, pointLabel: { visible: true } }),
      noop,
    );
    expect(calls.some((c) => c.op === "rect")).toBe(true);
    expect(texts(calls)).toEqual(expect.arrayContaining(["10", "12"]));
  });
});

describe("histogram 속성", () => {
  const input = (patch?: ChartOptionsPatch) => ({
    options: patch && opts(patch),
    width: 400,
    height: 300,
    title: "t",
    bins: { lo: 0, step: 10, count: 3 },
    counts: [[1], [5], [2]],
    color: "#2a78d6",
    shapes: [],
  });

  it("x축 min·max가 보이는 값 범위, pointLabel은 개수", () => {
    const { ctx, calls } = recorder();
    const meta = renderHistogram(
      ctx,
      input({
        axes: { x: { min: 5, max: 25 } },
        pointLabel: { visible: true },
      }),
      noop,
    );
    expect(meta.x.domain).toEqual([5, 25]);
    expect(texts(calls)).toEqual(expect.arrayContaining(["5", "2"]));
  });

  it("기본값을 넘겨도 같은 그림", () => {
    const a = recorder();
    const b = recorder();
    renderHistogram(a.ctx, input(), noop);
    renderHistogram(b.ctx, input({}), noop);
    expect(b.calls).toEqual(a.calls);
  });
});

describe("waterfall 속성", () => {
  const input = (patch?: ChartOptionsPatch) => ({
    options: patch && opts(patch),
    width: 400,
    height: 300,
    title: "t",
    categories: ["a", "b", "c"],
    values: [10, null, -4],
    color: "#2a78d6",
    shapes: [],
  });

  it("value.nullNumeric으로 빈 범주를 쌓고, pointLabel은 바뀐 값·합계", () => {
    const { ctx, calls } = recorder();
    const meta = renderWaterfall(
      ctx,
      input({ value: { nullNumeric: 3 }, pointLabel: { visible: true } }),
      noop,
    );
    expect(meta.steps.map((s) => s.end)).toEqual([10, 13, 9, 9]);
    expect(texts(calls)).toEqual(expect.arrayContaining(["3", "-4", "9"]));
  });

  it("기본값을 넘겨도 같은 그림", () => {
    const a = recorder();
    const b = recorder();
    renderWaterfall(a.ctx, input(), noop);
    renderWaterfall(b.ctx, input({}), noop);
    expect(b.calls).toEqual(a.calls);
  });
});

describe("bar 누적 (stack · stack100)", () => {
  const stacked = (stack: "stack" | "stack100"): CategoryInput => ({
    ...bar(),
    categories: ["a", "b"],
    bars: [
      [10, 30],
      [20, null],
    ],
    stack,
    legend: {
      title: "g",
      values: ["p", "q"],
      colors: ["#2a78d6", "#eb6834"],
      position: "top",
    },
  });

  it("stackSegments: legend 순서대로 쌓고, 끈 값과 빈 칸은 건너뛴다", () => {
    expect(
      stackSegments(
        [
          [10, 30],
          [20, -5],
        ],
        [],
        false,
      ),
    ).toEqual([
      [
        [0, 10],
        [10, 40],
      ],
      [
        [0, 20],
        [0, -5],
      ],
    ]);
    expect(stackSegments([[10, 30]], [true, false], true)).toEqual([
      [null, [0, 100]],
    ]);
  });

  it("stack은 범주 합계까지, stack100은 0~100% 축에 구간을 준다", () => {
    const sum = renderCategory(recorder().ctx, stacked("stack"), noop);
    expect(sum.stack).toBe("stack");
    expect(sum.segments?.[0]).toEqual([
      [0, 10],
      [10, 40],
    ]);
    expect(sum.y.domain[1]).toBeGreaterThanOrEqual(40);

    const pct = renderCategory(recorder().ctx, stacked("stack100"), noop);
    expect(pct.y.domain).toEqual([0, 100]);
    expect(pct.segments?.[0]).toEqual([
      [0, 25],
      [25, 100],
    ]);
    expect(pct.segments?.[1]).toEqual([[0, 100], null]);
  });

  it("나란히(기본)면 구간을 주지 않는다", () => {
    const meta = renderCategory(recorder().ctx, bar(), noop);
    expect(meta.segments).toBeUndefined();
    expect(meta.stack).toBeUndefined();
  });

  it("누적 막대는 범주 하나에 한 줄로 쌓아 같은 x에 그린다", () => {
    const { ctx, calls } = recorder();
    renderCategory(ctx, stacked("stack"), noop);
    // 앞의 roundRect는 legend 상자다. 막대는 마지막 셋(a 둘, b 하나)
    const rects = calls.filter((c) => c.op === "roundRect").slice(-3);
    // 범주 a의 두 막대는 x와 너비가 같다.
    expect(rects[0].args[0]).toBe(rects[1].args[0]);
    expect(rects[0].args[2]).toBe(rects[1].args[2]);
  });
});

describe("boxplot dot", () => {
  it("원값 표본을 상자 위에 점으로 찍고, metadata에는 넣지 않는다", () => {
    const input: CategoryInput = {
      ...bar(),
      chartType: "boxplot",
      bars: undefined,
      categories: ["a"],
      boxes: [[{ ...box(10, []), dots: [9, 10, 11, 50] }]],
    };
    const { ctx, calls } = recorder();
    const meta = renderCategory(ctx, input, noop);
    expect(calls.filter((c) => c.op === "arc").length).toBe(4);
    // 표본 값도 축 범위에 든다.
    expect(meta.y.domain[1]).toBeGreaterThanOrEqual(50);
    expect(meta.boxes?.[0]?.[0]).not.toHaveProperty("dots");
  });
});
