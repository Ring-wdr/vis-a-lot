// legend 순서와 범주 x축 순서가 그림·metadata·선택에 적용되는지. 색은 값을 따라 바뀌지 않는다.

import { describe, expect, it } from "vitest";
import type { ChartItem, ChartRecord } from "../charts/chart-store";
import { itemRowsScope } from "../charts/item-scope";
import {
  type CategoryInput,
  type CategoryMeta,
  renderCategory,
  stackSegments,
} from "./category";
import { orderHeatmap, renderHeatmap } from "./heatmap";
import { renderHistogram } from "./histogram";
import { drawLegendAround, type LegendInput, legendSequence } from "./legend";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { renderRadar } from "./radar";
import { renderWaterfall } from "./waterfall";

type Call = { op: string; args: unknown[]; state: Record<string, unknown> };

/** 그리기 호출을 그때의 fillStyle과 함께 기록하는 가짜 canvas */
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

/** 막대(roundRect) 왼쪽 x와 그 뒤 채운 색 */
function barsDrawn(calls: Call[]) {
  const out: { x: number; color: unknown }[] = [];
  calls.forEach((c, k) => {
    if (c.op !== "roundRect") return;
    const fill = calls.slice(k + 1).find((n) => n.op === "fill");
    out.push({ x: c.args[0] as number, color: fill?.state.fillStyle });
  });
  return out;
}

const LEGEND: LegendInput = {
  title: "근무조",
  values: ["주간", "야간"],
  colors: ["#111111", "#222222"],
};

const grouped = (legend: LegendInput = LEGEND): CategoryInput => ({
  chartType: "bar",
  width: 400,
  height: 300,
  title: "t",
  categories: ["a", "b"],
  bars: [
    [1, 2],
    [3, 4],
  ],
  agg: "avg",
  color: "#2a78d6",
  shapes: [],
  legend,
});

describe("legend 상자 순서", () => {
  const input: LegendInput = {
    title: "t",
    values: ["L2", "L10", "L1"],
    colors: ["#000002", "#000010", "#000001"],
    order: [2, 0, 1],
  };
  const plot = { left: 40, top: 40, width: 300, height: 200 };

  it("정한 순서로 놓고, 항목은 원래 인덱스와 값의 색을 그대로 갖는다", () => {
    const meta = drawLegendAround(recorder().ctx, input, plot, 20);
    expect(meta.entries.map((e) => [e.value, e.index, e.color])).toEqual([
      ["L1", 2, "#000001"],
      ["L2", 0, "#000002"],
      ["L10", 1, "#000010"],
    ]);
    // 전체 값과 색 목록은 원래 순서 그대로
    expect(meta.values).toEqual(["L2", "L10", "L1"]);
    expect(meta.colors).toEqual(["#000002", "#000010", "#000001"]);
  });

  it("reverse는 정한 순서를 뒤집는다", () => {
    const meta = drawLegendAround(
      recorder().ctx,
      input,
      plot,
      20,
      opts({ legend: { reverse: true } }),
    );
    expect(meta.entries.map((e) => e.value)).toEqual(["L10", "L2", "L1"]);
  });

  it("새 범례 항목처럼 순서에 없는 인덱스는 뒤에 붙는다", () => {
    expect(legendSequence({ ...input, order: [1] }, 4)).toEqual([1, 0, 2, 3]);
    expect(legendSequence(undefined, 3)).toEqual([0, 1, 2]);
  });
});

describe("bar · legend 순서", () => {
  it("나란히 놓는 자리가 legend 순서를 따르고 색은 값을 따른다", () => {
    const plain = recorder();
    const plainMeta = renderCategory(
      plain.ctx,
      { ...grouped(), compact: true },
      noop,
    );
    const ordered = recorder();
    const meta = renderCategory(
      ordered.ctx,
      { ...grouped({ ...LEGEND, order: [1, 0] }), compact: true },
      noop,
    );
    // 기본 순서: 주간(왼쪽) → 야간
    const before = barsDrawn(plain.calls);
    expect(before[0].x).toBeLessThan(before[1].x);
    expect(before.map((b) => b.color)).toEqual([
      "#111111",
      "#222222",
      "#111111",
      "#222222",
    ]);
    // 바꾼 순서: 야간이 왼쪽. 같은 값은 같은 색
    const after = barsDrawn(ordered.calls);
    expect(after[1].x).toBeLessThan(after[0].x);
    expect(after.map((b) => b.color)).toEqual(before.map((b) => b.color));
    // metadata: 칸은 legend 인덱스 그대로, 자리 순서만 legendOrder로 싣는다
    expect(meta.bars).toEqual(plainMeta.bars);
    expect(meta.legendOrder).toEqual([1, 0]);
    expect(plainMeta).not.toHaveProperty("legendOrder");
  });

  it("legend 상자도 같은 순서이고, 항목의 색은 그대로다", () => {
    const meta = renderCategory(
      recorder().ctx,
      grouped({ ...LEGEND, order: [1, 0] }),
      noop,
    );
    expect(meta.legend?.entries.map((e) => [e.value, e.color])).toEqual([
      ["야간", "#222222"],
      ["주간", "#111111"],
    ]);
  });

  it("누적은 legend 순서대로 아래부터 쌓는다", () => {
    const segs = stackSegments(
      [
        [1, 2],
        [3, 4],
      ],
      [],
      false,
      [1, 0],
    );
    expect(segs).toEqual([
      [
        [2, 3],
        [0, 2],
      ],
      [
        [4, 7],
        [0, 4],
      ],
    ]);
    // 순서를 주지 않으면 지금처럼 인덱스 순
    expect(stackSegments([[1, 2]], [], false)).toEqual([
      [
        [0, 1],
        [1, 3],
      ],
    ]);
  });

  it("기본 순서(order 없음)면 예전과 같은 그림·metadata", () => {
    const a = recorder();
    const b = recorder();
    const metaA = renderCategory(a.ctx, grouped(), noop);
    const metaB = renderCategory(
      b.ctx,
      grouped({ ...LEGEND, order: [0, 1] }),
      noop,
    );
    expect(metaB).toEqual(metaA);
    expect(b.calls).toEqual(a.calls);
  });
});

describe("범주 x축 순서", () => {
  it("bar: 직접 정한 범주를 앞에 두고 막대 행을 함께 옮긴다", () => {
    const meta = renderCategory(
      recorder().ctx,
      {
        ...grouped(),
        categories: ["L2", "L10", "L1"],
        bars: [
          [2, 0],
          [10, 0],
          [1, 0],
        ],
        options: opts({ axes: { x: { categoryOrder: ["L10"] } } }),
      },
      noop,
    );
    expect(meta.categories).toEqual(["L10", "L2", "L1"]);
    expect(meta.bars).toEqual([
      [10, 0],
      [2, 0],
      [1, 0],
    ]);
  });

  it("bar: natural은 나머지 범주를 자연 정렬한다", () => {
    const meta = renderCategory(
      recorder().ctx,
      {
        ...grouped(),
        categories: ["A12", "A3", "A1"],
        bars: [
          [12, 0],
          [3, 0],
          [1, 0],
        ],
        options: opts({ axes: { x: { categorySort: "natural" } } }),
      },
      noop,
    );
    expect(meta.categories).toEqual(["A1", "A3", "A12"]);
    expect(meta.bars?.map((r) => r[0])).toEqual([1, 3, 12]);
  });

  it("boxplot: 상자 행도 함께 옮긴다", () => {
    const box = (m: number) => ({
      n: 1,
      mean: m,
      q1: m,
      median: m,
      q3: m,
      lo: m,
      hi: m,
      outlierCount: 0,
      outliers: [],
    });
    const meta = renderCategory(
      recorder().ctx,
      {
        chartType: "boxplot",
        width: 400,
        height: 300,
        title: "t",
        categories: ["a", "b"],
        boxes: [[box(1)], [box(2)]],
        color: "#2a78d6",
        shapes: [],
        options: opts({ axes: { x: { categoryOrder: ["b"] } } }),
      },
      noop,
    );
    expect(meta.categories).toEqual(["b", "a"]);
    expect(meta.boxes?.map((r) => r[0]?.median)).toEqual([2, 1]);
  });

  it("waterfall: 바꾼 순서대로 누적한다", () => {
    const input = (patch?: ChartOptionsPatch) => ({
      options: patch && opts(patch),
      width: 400,
      height: 300,
      title: "t",
      categories: ["a", "b", "c"],
      values: [10, -4, 6],
      color: "#2a78d6",
      shapes: [],
    });
    const before = renderWaterfall(recorder().ctx, input(), noop);
    expect(before.steps.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [10, 6],
      [6, 12],
      [0, 12],
    ]);
    const after = renderWaterfall(
      recorder().ctx,
      input({ axes: { x: { categoryOrder: ["c", "b"] } } }),
      noop,
    );
    expect(after.categories).toEqual(["c", "b", "a"]);
    expect(after.steps.map((s) => [s.start, s.end])).toEqual([
      [0, 6],
      [6, 2],
      [2, 12],
      [0, 12],
    ]);
  });

  it("heatmap: x 범주와 칸 열을 함께 옮기고, 시계열 x는 옮기지 않는다", () => {
    const input = {
      options: opts({ axes: { x: { categoryOrder: ["b"] } } }),
      width: 400,
      height: 300,
      title: "t",
      xTitle: "x",
      yTitle: "y",
      xCategories: ["a", "b"],
      yCategories: ["p", "q"],
      cells: [
        [1, 2],
        [3, 4],
      ],
      agg: "avg" as const,
      shapes: [],
    };
    const meta = renderHeatmap(recorder().ctx, input, noop);
    expect(meta.xCategories).toEqual(["b", "a"]);
    expect(meta.cells).toEqual([
      [3, 4],
      [1, 2],
    ]);
    expect(meta.yCategories).toEqual(["p", "q"]);
    const timed = { ...input, xStarts: [0, 1000], timeBin: 1000 };
    expect(orderHeatmap(timed)).toBe(timed);
  });

  it("기본값(default, 빈 목록)이면 입력 그대로 그린다", () => {
    const a = recorder();
    const b = recorder();
    renderCategory(a.ctx, grouped(), noop);
    renderCategory(
      b.ctx,
      {
        ...grouped(),
        options: opts({
          axes: { x: { categorySort: "default", categoryOrder: [] } },
        }),
      },
      noop,
    );
    expect(b.calls).toEqual(a.calls);
  });
});

describe("histogram · legend 순서", () => {
  it("구간 안 막대 자리가 legend 순서를 따르고 legendOrder를 싣는다", () => {
    const input = (legend: LegendInput) => ({
      width: 400,
      height: 300,
      title: "t",
      bins: { lo: 0, step: 10, count: 1 },
      counts: [[5, 7]],
      color: "#2a78d6",
      shapes: [],
      legend,
      compact: true,
    });
    const plain = recorder();
    renderHistogram(plain.ctx, input(LEGEND), noop);
    const ordered = recorder();
    const meta = renderHistogram(
      ordered.ctx,
      input({ ...LEGEND, order: [1, 0] }),
      noop,
    );
    const rects = (calls: Call[]) =>
      calls
        .filter((c) => c.op === "rect")
        .slice(1)
        .map((c) => c.args[0] as number);
    const [a0, a1] = rects(plain.calls);
    const [b0, b1] = rects(ordered.calls);
    expect(a0).toBeLessThan(a1);
    expect(b0).toBeGreaterThan(b1);
    expect(meta.counts).toEqual([[5, 7]]);
    expect(meta.legendOrder).toEqual([1, 0]);
  });
});

describe("radar · legend 순서", () => {
  it("계열을 legend 순서대로 그리고 metadata 계열은 인덱스 순 그대로다", () => {
    const input = (legend: LegendInput) => ({
      width: 400,
      height: 300,
      title: "t",
      color: "#2a78d6",
      axisTitle: "축",
      seriesName: "값",
      axes: ["p", "q", "r"],
      cells: [
        [1, 2],
        [2, 3],
        [3, 1],
      ],
      agg: "avg" as const,
      legend,
      compact: true,
    });
    const { ctx, calls } = recorder();
    const meta = renderRadar(ctx, input({ ...LEGEND, order: [1, 0] }), noop);
    const filled = calls
      .filter((c) => c.op === "fill")
      .map((c) => c.state.fillStyle)
      .filter((c) => c === "#111111" || c === "#222222");
    expect(filled[0]).toBe("#222222");
    expect(meta.series.map((s) => s.index)).toEqual([0, 1]);
  });
});

describe("선택 영역 안의 막대 (데이터 표)", () => {
  it("legend 순서를 바꿔도 그린 자리로 [범주, legend 값]을 고른다", () => {
    // 범주 0의 왼쪽 자리만 덮는 영역 (범주 인덱스 공간 -0.35 ~ 0)
    const selection = {
      type: "rect" as const,
      x0: -0.34,
      y0: 0,
      x1: -0.01,
      y1: 10,
    };
    const meta = renderCategory(
      recorder().ctx,
      { ...grouped({ ...LEGEND, order: [1, 0] }), selection },
      noop,
    );
    expect(meta.selected).toBe(1);
    const chart = {
      spec: {
        chartType: "bar",
        x: "x",
        y: "y",
        legend: "shift",
        splitBy: [],
        filters: [],
        tooltip: [],
      },
    } as unknown as ChartRecord;
    const item = {
      values: [],
      selection,
      deletions: [],
      meta: meta as CategoryMeta,
    } as unknown as ChartItem;
    // 왼쪽 자리는 야간(1)이다.
    expect(itemRowsScope(chart, item).selectedMarks).toEqual([["a", "야간"]]);
  });
});
