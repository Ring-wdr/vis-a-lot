// 관리선 그리기: 선 종류별 픽셀 위치, 영역 In·Out, 이탈 판정·수, 축 범위, 로그 축, 섬네일, metadata, Score 연결.
// 선이 없을 때 그림이 지금과 같은지는 limits 유무를 바꿔 호출 기록을 비교한다.

import { describe, expect, it } from "vitest";
import { type CategoryInput, renderCategory } from "./category";
import {
  BAND_FILL_ALPHA,
  fitLimitDomain,
  type LimitView,
  limitJudge,
  limitTransforms,
  prepareLimits,
  type ResolvedLimit,
  scoreLimits,
  stepAt,
  visibleLimits,
} from "./control-limit";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DARK_OPTIONS,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { renderScatter, type ScatterInput } from "./scatter";

type Call = { op: string; args: unknown[]; state: Record<string, unknown> };

/** 그리기 호출을 그때의 상태(색·굵기·대시)와 함께 기록하는 가짜 canvas */
function recorder(width = 400, height = 300) {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    dash: [],
    canvas: { width, height },
  };
  const methods: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    setLineDash: (d: number[]) => {
      state.dash = d;
    },
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
const opts = (patch: ChartOptionsPatch = {}): ChartOptions =>
  mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);

const line = (
  over: Partial<ResolvedLimit> & { value?: number },
): ResolvedLimit =>
  ({
    name: "L",
    kind: "reference",
    axis: "left",
    type: "none",
    color: "#ff00ff",
    width: 1,
    style: "solid",
    multi: false,
    value: 0,
    ...over,
  }) as ResolvedLimit;

/** y = 0..10 (x = 0..10) 점 11개 */
function scatter(
  limits: ResolvedLimit[] | undefined,
  patch: ChartOptionsPatch = {},
  extra: Partial<ScatterInput> = {},
): ScatterInput {
  const xs = Float64Array.from({ length: 11 }, (_, i) => i);
  return {
    options: opts(patch),
    width: 400,
    height: 300,
    title: "t",
    xKind: "number",
    xs,
    ys: Float64Array.from(xs),
    ids: Float64Array.from(xs),
    color: "#2a78d6",
    shapes: [],
    limits,
    ...extra,
  };
}

/** 선 색으로 그은 stroke 직전의 moveTo/lineTo 좌표 */
function strokesOf(calls: Call[], color: string) {
  const out: [string, number, number][][] = [];
  let path: [string, number, number][] = [];
  for (const c of calls) {
    if (c.op === "beginPath") path = [];
    else if (c.op === "moveTo" || c.op === "lineTo")
      path.push([c.op, c.args[0] as number, c.args[1] as number]);
    else if (c.op === "stroke" && c.state.strokeStyle === color) {
      out.push(path);
    }
  }
  return out;
}

const fills = (calls: Call[], color: string) =>
  calls.filter((c) => c.op === "fillRect" && c.state.fillStyle === color);

const texts = (calls: Call[]) =>
  calls.filter((c) => c.op === "fillText").map((c) => c.args[0] as string);

describe("선이 없으면 지금과 같다", () => {
  it("scatter·line: limits가 없거나 빈 목록이면 호출 기록과 metadata가 같다", () => {
    for (const chartType of ["scatter", "line"] as const) {
      const a = recorder();
      const b = recorder();
      const ma = renderScatter(
        a.ctx,
        scatter(undefined, {}, { chartType }),
        noop,
      );
      const mb = renderScatter(b.ctx, scatter([], {}, { chartType }), noop);
      expect(b.calls).toEqual(a.calls);
      expect(mb).toEqual(ma);
      expect(ma.limits).toBeUndefined();
    }
  });

  it("bar: limits가 없거나 빈 목록이면 같다", () => {
    const input = (limits?: ResolvedLimit[]): CategoryInput => ({
      chartType: "bar",
      width: 400,
      height: 300,
      title: "t",
      categories: ["a", "b"],
      bars: [[3], [8]],
      color: "#000000",
      shapes: [],
      limits,
    });
    const a = recorder();
    const b = recorder();
    const ma = renderCategory(a.ctx, input(), noop);
    const mb = renderCategory(b.ctx, input([]), noop);
    expect(b.calls).toEqual(a.calls);
    expect(mb).toEqual(ma);
    expect(ma.limits).toBeUndefined();
  });
});

describe("선 그리기", () => {
  it("기준선: left는 y 값 자리에 그림 영역 폭만큼, bottom은 x 값 자리에 높이만큼", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter([
        line({ value: 5, color: "#aa0000" }),
        line({ axis: "bottom", value: 2, color: "#00aa00" }),
      ]),
      noop,
    );
    const { plot } = meta;
    const yAt = (v: number) =>
      plot.top +
      plot.height -
      ((v - meta.y.domain[0]) / (meta.y.domain[1] - meta.y.domain[0])) *
        plot.height;
    const xAt = (v: number) =>
      plot.left +
      ((v - meta.x.domain[0]) / (meta.x.domain[1] - meta.x.domain[0])) *
        plot.width;
    const [h] = strokesOf(calls, "#aa0000");
    expect(h).toEqual([
      ["moveTo", plot.left, Math.round(yAt(5)) + 0.5],
      ["lineTo", plot.left + plot.width, Math.round(yAt(5)) + 0.5],
    ]);
    const [v] = strokesOf(calls, "#00aa00");
    expect(v).toEqual([
      ["moveTo", Math.round(xAt(2)) + 0.5, plot.top],
      ["lineTo", Math.round(xAt(2)) + 0.5, plot.top + plot.height],
    ]);
  });

  it("굵기·모양: 짝수 굵기는 정수 픽셀, 파선·점선 대시", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter([
        line({ value: 5, width: 2, style: "dash", color: "#aa0000" }),
        line({ name: "D", value: 3, style: "dot", color: "#00aa00" }),
      ]),
      noop,
    );
    const dash = calls.find(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#aa0000",
    );
    expect(dash?.state.lineWidth).toBe(2);
    expect(dash?.state.dash).toEqual([8, 6]);
    const [h] = strokesOf(calls, "#aa0000");
    expect(Number.isInteger(h[0][2])).toBe(true);
    const dot = calls.find(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#00aa00",
    );
    expect(dot?.state.lineCap).toBe("round");
    expect(dot?.state.dash).toEqual([0.01, 2.5]);
  });

  it("컬럼 선 구간별: 이어진 구간은 계단으로 잇고 빈 구간에서 끊는다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter([
        line({
          kind: "column",
          multi: true,
          steps: [
            [0, 2, 4],
            [2, 4, 6],
            [6, 10, 8],
          ],
          color: "#aa0000",
        } as Partial<ResolvedLimit>),
      ]),
      noop,
    );
    const [path] = strokesOf(calls, "#aa0000");
    // 구간 0·1은 한 줄로 이어지고(세로 이음 포함), 구간 2는 새로 시작한다.
    expect(path.map((p) => p[0])).toEqual([
      "moveTo",
      "lineTo",
      "lineTo",
      "lineTo",
      "moveTo",
      "lineTo",
    ]);
    const { plot } = meta;
    const xAt = (v: number) =>
      plot.left +
      ((v - meta.x.domain[0]) / (meta.x.domain[1] - meta.x.domain[0])) *
        plot.width;
    expect(path[0][1]).toBeCloseTo(xAt(0));
    expect(path[3][1]).toBeCloseTo(xAt(4));
    expect(path[4][1]).toBeCloseTo(xAt(6));
    // 세로 이음: 구간 경계 x에서 값이 4 → 6으로
    expect(path[2][1]).toBeCloseTo(xAt(2));
    expect(path[2][2]).toBeLessThan(path[1][2]);
    expect(meta.limits?.lines[0].steps).toHaveLength(3);
  });

  it("띠: 두 선과 그 사이를 선 색으로 옅게 채운다 (구간별이면 구간마다)", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter([
        line({ kind: "band", value: 3, value2: 6, color: "#0000aa" }),
        line({
          name: "B2",
          kind: "band",
          multi: true,
          steps: [
            [0, 5, 1, 2],
            [5, 10, 2, 3],
          ],
          color: "#00aa00",
        } as Partial<ResolvedLimit>),
      ]),
      noop,
    );
    const [band] = strokesOf(calls, "#0000aa");
    expect(band.filter((p) => p[0] === "moveTo")).toHaveLength(2);
    const fill = fills(calls, "#0000aa");
    expect(fill).toHaveLength(1);
    expect(fill[0].state.globalAlpha).toBe(BAND_FILL_ALPHA);
    expect(fills(calls, "#00aa00")).toHaveLength(2);
    // 띠 채움은 격자(첫 그리드 stroke)보다 먼저다.
    const firstFill = calls.indexOf(fill[0]);
    const firstGrid = calls.findIndex(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#e7e6e2",
    );
    expect(firstFill).toBeLessThan(firstGrid);
  });

  it("글자: 선 끝에 `이름 값`, 선택 밖 흐리게보다 위에 선을 긋는다", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter(
        [line({ name: "USL", type: "usl", value: 7.5 })],
        {},
        {
          selection: { type: "rect", x0: 0, x1: 3, y0: 0, y1: 3 },
        },
      ),
      noop,
    );
    expect(texts(calls)).toContain("USL 7.5");
    const dim = calls.findIndex(
      (c) => c.op === "fill" && c.args[0] === "evenodd",
    );
    const stroke = calls.findIndex(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#ff00ff",
    );
    expect(dim).toBeGreaterThan(0);
    expect(stroke).toBeGreaterThan(dim);
  });

  it("글자가 겹치면 비켜 놓고, 끄면 그리지 않는다", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter([
        line({ name: "A", value: 5 }),
        line({ name: "B", value: 5.01 }),
      ]),
      noop,
    );
    const ys = calls
      .filter((c) => c.op === "fillText" && /^[AB] /.test(c.args[0] as string))
      .map((c) => c.args[2] as number);
    expect(ys).toHaveLength(2);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(10);

    const off = recorder();
    renderScatter(
      off.ctx,
      scatter([line({ name: "A", value: 5 })], {
        controlLimit: { text: { visible: false } },
      }),
      noop,
    );
    expect(texts(off.calls).some((t) => t.startsWith("A "))).toBe(false);
  });

  it("글자 색: 비우면 눈금 글자 색(다크 테마면 다크 값), 정하면 그 색. 선 색은 테마와 상관없다", () => {
    const dark = mergeOptions<ChartOptions>(DEFAULT_OPTIONS, DARK_OPTIONS);
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      { ...scatter([line({ name: "A", value: 5 })]), options: dark },
      noop,
    );
    const text = calls.find((c) => c.op === "fillText" && c.args[0] === "A 5");
    expect(text?.state.fillStyle).toBe(dark.axes.y.label.color);
    expect(strokesOf(calls, "#ff00ff")).toHaveLength(1);

    const own = recorder();
    renderScatter(
      own.ctx,
      scatter([line({ name: "A", value: 5 })], {
        controlLimit: { text: { color: "#123456" } },
      }),
      noop,
    );
    expect(
      own.calls.find((c) => c.op === "fillText" && c.args[0] === "A 5")?.state
        .fillStyle,
    ).toBe("#123456");
  });

  it("섬네일: 선은 그리고 글자는 뺀다", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter([line({ name: "A", value: 5, width: 3 })], {}, { compact: true }),
      noop,
    );
    const s = calls.find(
      (c) => c.op === "stroke" && c.state.strokeStyle === "#ff00ff",
    );
    expect(s?.state.lineWidth).toBe(2);
    expect(texts(calls)).not.toContain("A 5");
  });
});

describe("규격 이탈", () => {
  const spec = [
    line({ name: "USL", type: "usl", value: 8 }),
    line({ name: "LSL", type: "lsl", value: 2 }),
  ];

  it("USL보다 크거나 LSL보다 작은 점을 세어 요약·metadata에 담고 이탈 색으로 다시 찍는다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(ctx, scatter(spec), noop);
    // y = 0, 1, 9, 10
    expect(meta.limits?.out).toBe(4);
    expect(texts(calls).some((t) => t.includes("이탈 4"))).toBe(true);
    const out = calls.filter(
      (c) => c.op === "fill" && c.state.fillStyle === "#e03131",
    );
    expect(out).toHaveLength(1);
    expect(calls.filter((c) => c.op === "arc").length).toBeGreaterThanOrEqual(
      11 + 4,
    );
  });

  it("끈 legend 값의 점은 세지 않고, 강조를 끄면 수만 센다", () => {
    const input = scatter(
      spec,
      { controlLimit: { highlightOut: false } },
      {
        legend: {
          title: "g",
          values: ["a", "b"],
          colors: ["#111111", "#222222"],
          hidden: ["b"],
          index: Uint8Array.from({ length: 11 }, (_, i) => (i === 10 ? 1 : 0)),
        },
      },
    );
    const { ctx, calls } = recorder();
    const meta = renderScatter(ctx, input, noop);
    expect(meta.limits?.out).toBe(3);
    expect(
      calls.some((c) => c.op === "fill" && c.state.fillStyle === "#e03131"),
    ).toBe(false);
  });

  it("규격 선이 없으면 이탈을 적지 않고 out은 0", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(ctx, scatter([line({ value: 5 })]), noop);
    expect(meta.limits?.out).toBe(0);
    expect(texts(calls).some((t) => t.includes("이탈"))).toBe(false);
  });

  it("focus와 함께면 이탈 점 위에 focus 점을 다시 그린다", () => {
    const { ctx, calls } = recorder();
    renderScatter(
      ctx,
      scatter(spec, { focus: { enabled: true, value: 9.5 } }),
      noop,
    );
    const outFill = calls.findIndex(
      (c) => c.op === "fill" && c.state.fillStyle === "#e03131",
    );
    const lastFocus = calls.findLastIndex(
      (c) => c.op === "fill" && c.state.fillStyle === "#e34948",
    );
    expect(lastFocus).toBeGreaterThan(outFill);
  });

  it("line은 원자료 점으로 판정하고 이탈 점을 점으로 찍는다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter(spec, {}, { chartType: "line" }),
      noop,
    );
    expect(meta.limits?.out).toBe(4);
    expect(
      calls.some((c) => c.op === "fill" && c.state.fillStyle === "#e03131"),
    ).toBe(true);
  });

  it("구간별 규격은 점이 든 구간의 값과 비교하고, 값이 없는 구간은 판정하지 않는다", () => {
    const { ctx } = recorder();
    const meta = renderScatter(
      ctx,
      scatter([
        line({
          type: "usl",
          kind: "column",
          multi: true,
          steps: [
            [0, 4, 3],
            [8, 10, 100],
          ],
        } as Partial<ResolvedLimit>),
      ]),
      noop,
    );
    // x 0..4 중 y > 3: 4 하나. x 5..7은 구간이 없다. x 8..10은 100 아래
    expect(meta.limits?.out).toBe(1);
  });

  it("bottom 축 규격은 x로 판정한다", () => {
    const { ctx } = recorder();
    const meta = renderScatter(
      ctx,
      scatter([line({ axis: "bottom", type: "usl", value: 7 })]),
      noop,
    );
    expect(meta.limits?.out).toBe(3);
  });
});

describe("영역 채우기", () => {
  const yPx = (
    meta: {
      plot: { top: number; height: number };
      y: { domain: [number, number] };
    },
    v: number,
  ) =>
    meta.plot.top +
    meta.plot.height -
    ((v - meta.y.domain[0]) / (meta.y.domain[1] - meta.y.domain[0])) *
      meta.plot.height;

  it("In: USL과 LSL 사이, 하나뿐이면 선에서 그림 영역 끝까지", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter(
        [
          line({ name: "U", type: "usl", value: 8 }),
          line({ name: "L", type: "lsl", value: 2 }),
        ],
        { controlLimit: { area: { visible: true } } },
      ),
      noop,
    );
    const [rect] = fills(calls, "#2f9e44");
    expect(rect.state.globalAlpha).toBeCloseTo(0.2);
    expect(rect.args[1]).toBeCloseTo(yPx(meta, 8));
    expect((rect.args[1] as number) + (rect.args[3] as number)).toBeCloseTo(
      yPx(meta, 2),
    );

    const one = recorder();
    const m1 = renderScatter(
      one.ctx,
      scatter([line({ type: "usl", value: 8 })], {
        controlLimit: { area: { visible: true } },
      }),
      noop,
    );
    const [r1] = fills(one.calls, "#2f9e44");
    expect(r1.args[1]).toBeCloseTo(yPx(m1, 8));
    expect((r1.args[1] as number) + (r1.args[3] as number)).toBeCloseTo(
      m1.plot.top + m1.plot.height,
    );
  });

  it("Out: 규격 바깥 두 쪽을 채운다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter(
        [
          line({ name: "U", type: "usl", value: 8 }),
          line({ name: "L", type: "lsl", value: 2 }),
        ],
        { controlLimit: { area: { visible: true, side: "out" } } },
      ),
      noop,
    );
    const rects = fills(calls, "#2f9e44");
    expect(rects).toHaveLength(2);
    expect(rects[0].args[1]).toBe(meta.plot.top);
    expect(
      (rects[0].args[1] as number) + (rects[0].args[3] as number),
    ).toBeCloseTo(yPx(meta, 8));
    expect(rects[1].args[1]).toBeCloseTo(yPx(meta, 2));
  });

  it("뒤집힌 규격(USL < LSL)은 채우지도 판정하지도 않는다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter(
        [
          line({ name: "U", type: "usl", value: 2 }),
          line({ name: "L", type: "lsl", value: 8 }),
        ],
        { controlLimit: { area: { visible: true } } },
      ),
      noop,
    );
    expect(fills(calls, "#2f9e44")).toHaveLength(0);
    expect(meta.limits?.out).toBe(0);
  });
});

describe("축 범위", () => {
  it("fitAxis: 데이터 밖의 선이 보이도록 넓히고, 끄면 데이터 범위만", () => {
    const lines = [line({ value: 30 }), line({ axis: "bottom", value: -20 })];
    const on = renderScatter(recorder().ctx, scatter(lines), noop);
    expect(on.y.domain[1]).toBeGreaterThanOrEqual(30);
    expect(on.x.domain[0]).toBeLessThanOrEqual(-20);
    const off = renderScatter(
      recorder().ctx,
      scatter(lines, { controlLimit: { fitAxis: false } }),
      noop,
    );
    expect(off.y.domain[1]).toBe(10);
    expect(off.x.domain[0]).toBe(0);
  });

  it("확대 중이면 확대 범위 그대로, 선은 잘리고 글자는 그리지 않는다", () => {
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      scatter(
        [line({ name: "A", value: 30 })],
        {},
        {
          view: { x: [0, 5], y: [0, 5] },
        },
      ),
      noop,
    );
    expect(meta.y.domain).toEqual([0, 5]);
    expect(texts(calls)).not.toContain("A 30");
    expect(meta.limits?.lines).toHaveLength(1);
  });

  it("로그 축: 0 이하 선은 축을 넓히지도 그리지도 않는다", () => {
    const xs = Float64Array.from({ length: 10 }, (_, i) => i + 1);
    const { ctx, calls } = recorder();
    const meta = renderScatter(
      ctx,
      {
        ...scatter(
          [
            line({ name: "Z", value: -1, color: "#aa0000" }),
            line({ name: "P", value: 100, color: "#00aa00" }),
          ],
          { axes: { y: { log: true } } },
        ),
        xs,
        ys: Float64Array.from(xs),
        ids: Float64Array.from(xs),
      },
      noop,
    );
    expect(meta.y.log).toBe(true);
    expect(meta.y.domain[1]).toBeGreaterThanOrEqual(100);
    expect(strokesOf(calls, "#aa0000")).toHaveLength(0);
    expect(strokesOf(calls, "#00aa00")).toHaveLength(1);
    expect(meta.limits?.lines.map((l) => l.name)).toEqual(["P"]);
  });
});

describe("Score 연결", () => {
  it("score.ucl·lcl이 비면 left USL·LSL을, 적었으면 적은 값을 쓴다", () => {
    const meta = renderScatter(
      recorder().ctx,
      scatter(
        [
          line({ name: "U", type: "usl", value: 8 }),
          line({ name: "L", type: "lsl", value: 2 }),
        ],
        { score: { visible: true, kinds: ["zscore"] } },
      ),
      noop,
    );
    expect(meta.scores?.[0].value).not.toBeNull();
    const views = prepareLimits([
      line({ type: "usl", value: 8 }),
      line({ type: "lsl", value: 2 }),
    ]);
    expect(scoreLimits(views, { ucl: null, lcl: null })).toEqual({
      ucl: 8,
      lcl: 2,
    });
    expect(scoreLimits(views, { ucl: 9, lcl: null })).toEqual({
      ucl: 9,
      lcl: 2,
    });
    const multi = prepareLimits([
      line({
        type: "usl",
        kind: "column",
        multi: true,
        steps: [[0, 1, 5]],
      } as Partial<ResolvedLimit>),
    ]);
    expect(scoreLimits(multi, { ucl: null, lcl: null }).ucl).toBeNull();
  });
});

describe("bar", () => {
  const bar = (
    limits: ResolvedLimit[],
    patch: ChartOptionsPatch = {},
    extra: Partial<CategoryInput> = {},
  ): CategoryInput => ({
    options: opts(patch),
    chartType: "bar",
    width: 400,
    height: 300,
    title: "t",
    categories: ["a", "b", "c"],
    bars: [[3], [8], [12]],
    color: "#000000",
    shapes: [],
    limits,
    ...extra,
  });

  it("기준선을 긋고 USL을 넘은 막대를 세어 이탈 색으로 다시 칠한다", () => {
    const { ctx, calls } = recorder();
    const meta = renderCategory(
      ctx,
      bar([line({ name: "USL", type: "usl", value: 10, color: "#aa0000" })]),
      noop,
    );
    expect(meta.limits).toEqual({
      lines: [{ name: "USL", axis: "left", type: "usl", value: 10 }],
      out: 1,
    });
    expect(strokesOf(calls, "#aa0000")).toHaveLength(1);
    expect(
      calls.filter((c) => c.op === "fill" && c.state.fillStyle === "#e03131"),
    ).toHaveLength(1);
    expect(texts(calls).some((t) => t.includes("이탈 1"))).toBe(true);
    expect(texts(calls)).toContain("USL 10");
  });

  it("축 범위를 선까지 넓힌다", () => {
    const meta = renderCategory(
      recorder().ctx,
      bar([line({ value: 40 })]),
      noop,
    );
    expect(meta.y.domain[1]).toBeGreaterThanOrEqual(40);
  });

  it("누적 막대는 쌓은 끝 값으로 판정한다", () => {
    const meta = renderCategory(
      recorder().ctx,
      bar(
        [line({ type: "usl", value: 6 })],
        {},
        {
          bars: [
            [3, 2],
            [4, 4],
          ],
          categories: ["a", "b"],
          stack: "stack",
          legend: { title: "g", values: ["x", "y"], colors: ["#111", "#222"] },
        },
      ),
      noop,
    );
    // 범주 b: 0..4, 4..8 → 위 막대 끝 8 > 6
    expect(meta.limits?.out).toBe(1);
  });

  it("y 식을 컬럼 선에 옮기고 기준선은 그대로 둔다", () => {
    const meta = renderCategory(
      recorder().ctx,
      bar(
        [
          line({
            name: "C",
            kind: "column",
            value: 5,
          } as Partial<ResolvedLimit>),
          line({ name: "R", value: 5 }),
        ],
        { expression: { y: "y * 2" } },
      ),
      noop,
    );
    expect(meta.limits?.lines.map((l) => l.value)).toEqual([10, 5]);
  });
});

describe("함수", () => {
  const view = (over: Partial<LimitView>): LimitView => ({
    name: "L",
    axis: "left",
    type: "none",
    kind: "reference",
    color: "#000",
    width: 1,
    style: "solid",
    ...over,
  });

  it("limitTransforms: 다른 축 변수를 쓰는 식이면 NaN", () => {
    const t = limitTransforms({ x: "", y: "y / 10" });
    expect(t.x).toBeUndefined();
    expect(t.y?.(50)).toBe(5);
    expect(Number.isNaN(limitTransforms({ x: "", y: "x + y" }).y?.(1))).toBe(
      true,
    );
    // 식을 옮길 수 없는 컬럼 선은 빠진다.
    expect(
      prepareLimits(
        [line({ kind: "column", value: 1 } as Partial<ResolvedLimit>)],
        {
          y: limitTransforms({ x: "", y: "x + y" }).y,
        },
      ),
    ).toEqual([]);
  });

  it("fitLimitDomain: 그 축 값만, log면 0 이하는 넣지 않는다", () => {
    const lines = [
      view({ value: 50 }),
      view({ value: -5 }),
      view({ axis: "bottom", value: 1000 }),
    ];
    expect(fitLimitDomain([0, 10], lines, "left", false)).toEqual([-5, 50]);
    expect(fitLimitDomain([1, 10], lines, "left", true)).toEqual([1, 50]);
  });

  it("visibleLimits: 로그 축이면 0 이하 구간만 빼고 다 빠지면 선을 뺀다", () => {
    const lines = [
      view({
        steps: [
          [0, 1, -1],
          [1, 2, 3],
        ],
      }),
      view({ kind: "band", value: 1, value2: 0 }),
    ];
    const out = visibleLimits(lines, { left: true, bottom: false });
    expect(out).toHaveLength(1);
    expect(out[0].steps).toEqual([[1, 2, 3]]);
  });

  it("stepAt: 경계는 오른쪽 구간, 마지막 끝은 포함, 빈 구간은 없음", () => {
    const steps: [number, number, number][] = [
      [0, 1, 10],
      [1, 2, 20],
      [5, 6, 30],
    ];
    expect(stepAt(steps, 1)?.[2]).toBe(20);
    expect(stepAt(steps, 6)?.[2]).toBe(30);
    expect(stepAt(steps, 3)).toBeUndefined();
    expect(stepAt(steps, -1)).toBeUndefined();
  });

  it("limitJudge: 규격 선이 없으면 undefined, 경계 값은 이탈이 아니다", () => {
    expect(limitJudge([view({ value: 1 })])).toBeUndefined();
    const judge = limitJudge([view({ type: "usl", value: 5 })]);
    expect(judge?.(0, 5)).toBe(false);
    expect(judge?.(0, 5.1)).toBe(true);
  });
});
