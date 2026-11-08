import { describe, expect, it } from "vitest";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import {
  renderScatter,
  type ScatterInput,
  withExpression,
  withoutOutliers,
} from "./scatter";

/** 그리기는 무시하고 글자·호출만 남기는 가짜 캔버스 */
function fakeCtx(width: number, height: number) {
  const texts: string[] = [];
  const calls: Record<string, number> = {};
  const target: Record<string, unknown> = {
    canvas: { width, height },
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillText: (t: string) => {
      texts.push(t);
    },
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  const ctx = new Proxy(target, {
    get: (t, key: string) => {
      if (key in t) return t[key];
      return () => {
        calls[key] = (calls[key] ?? 0) + 1;
      };
    },
    set: (t, key: string, value) => {
      t[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, texts, calls };
}

const noop = () => {};

function input(
  patch: ChartOptionsPatch = {},
  extra: Partial<ScatterInput> = {},
): ScatterInput {
  const n = 40;
  const xs = Float64Array.from({ length: n }, (_, i) => i + 1);
  const ys = Float64Array.from({ length: n }, (_, i) => (i % 10) + 1);
  return {
    width: 400,
    height: 300,
    title: "item",
    xKind: "number",
    xs,
    ys,
    ids: Float64Array.from({ length: n }, (_, i) => i),
    color: "#2a78d6",
    shapes: [],
    options: mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch),
    ...extra,
  };
}

function render(i: ScatterInput) {
  const { ctx, texts, calls } = fakeCtx(i.width, i.height);
  const meta = renderScatter(ctx, i, noop);
  return { meta, texts, calls };
}

describe("scatter 속성", () => {
  it("기본 옵션은 옵션 없이 그린 것과 같은 metadata를 낸다", () => {
    const withDefaults = render(input()).meta;
    const { options: _o, ...bare } = input();
    expect(render(bare).meta).toEqual(withDefaults);
  });

  it("panel 여백만큼 그림 영역이 줄어든다", () => {
    const base = render(input()).meta.plot;
    const plot = render(
      input({ panel: { margin: { top: 10, left: 20, right: 5, bottom: 7 } } }),
    ).meta.plot;
    expect(plot.left).toBe(base.left + 20);
    expect(plot.top).toBe(base.top + 10);
    expect(plot.width).toBe(base.width - 25);
    expect(plot.height).toBe(base.height - 17);
  });

  it("y 로그 축과 min·max를 쓰고, 확대 범위가 min·max보다 이긴다", () => {
    const log = render(input({ axes: { y: { log: true } } })).meta;
    expect(log.y.log).toBe(true);
    const fixed = render(input({ axes: { y: { min: 0, max: 100 } } })).meta;
    expect(fixed.y.domain).toEqual([0, 100]);
    const zoomed = render(
      input(
        { axes: { y: { min: 0, max: 100 } } },
        { view: { x: [1, 10], y: [2, 5] } },
      ),
    ).meta;
    expect(zoomed.y.domain).toEqual([2, 5]);
  });

  it("expression은 변환한 값을 metadata 좌표로 쓴다", () => {
    const meta = render(input({ expression: { y: "y * 10" } })).meta;
    expect(Math.max(...meta.points.y)).toBe(100);
    expect(meta.y.domain[1]).toBeGreaterThanOrEqual(100);
  });

  it("틀린 식은 데이터를 그대로 두고 요약에 오류를 적는다", () => {
    const { meta, texts } = render(input({ expression: { y: "y +" } }));
    expect(Math.max(...meta.points.y)).toBe(10);
    expect(texts.some((t) => t.includes("y 식"))).toBe(true);
  });

  it("NaN이 되는 행은 뺀다", () => {
    const { input: out } = withExpression(input(), { x: "", y: "ln(y - 5)" });
    expect(out.ys.length).toBe(20);
  });

  it("이상치를 빼면 total이 줄어든다", () => {
    const i = input();
    i.ys[0] = 1000;
    const { removed } = withoutOutliers(i, {
      ...DEFAULT_OPTIONS.value,
      outlier: true,
    });
    expect(removed).toBe(1);
    const meta = render({
      ...i,
      options: mergeOptions<ChartOptions>(DEFAULT_OPTIONS, {
        value: { outlier: true },
      }),
    }).meta;
    expect(meta.total).toBe(39);
  });

  it("score 상자에 고른 점수를 적고 metadata에 남긴다", () => {
    const { meta, texts } = render(
      input({ score: { visible: true, kinds: ["rscore", "cpk"], ucl: 12 } }),
    );
    expect(meta.scores?.map((s) => s.kind)).toEqual(["rscore", "cpk"]);
    expect(texts.some((t) => t.startsWith("r = "))).toBe(true);
    expect(texts.some((t) => t.startsWith("Cpk = "))).toBe(true);
  });

  it("예측은 x 범위를 넓히고 설명을 적는다", () => {
    const base = render(input()).meta;
    const { meta, texts } = render(
      input({
        prediction: { enabled: true, method: "ses", period: 10 },
      }),
    );
    expect(meta.x.domain[1]).toBeGreaterThan(base.x.domain[1]);
    expect(texts.some((t) => t.includes("지수 평활"))).toBe(true);
  });

  it("line도 계열별 예측·점 모양 옵션으로 그린다", () => {
    const { meta } = render(
      input(
        {
          prediction: { enabled: true, method: "sma", window: 3 },
          shape: { type: "diamond", borderWidth: 1 },
          size: { lineWidth: 3 },
        },
        { chartType: "line" },
      ),
    );
    expect(meta.chartType).toBe("line");
    expect(meta.total).toBe(40);
  });

  it("focus에 맞는 점을 다시 그린다", () => {
    const off = render(input({ shape: { type: "square" } })).calls;
    const on = render(
      input({
        shape: { type: "square" },
        focus: { enabled: true, operator: ">", value: 8 },
      }),
    ).calls;
    // square 점은 rect로, focus 점(기본 원)은 arc로 그 위에 더 그린다. y > 8인 점은 8개다.
    expect(off.arc ?? 0).toBe(0);
    expect(on.arc).toBe(8);
  });

  it("기본 점은 테두리 있는 원으로 하나씩 그린다", () => {
    const { calls } = render(input());
    expect(calls.arc).toBe(40);
    expect(calls.stroke).toBeGreaterThanOrEqual(40);
  });

  it("같은 픽셀 칸에 겹친 점은 상한까지만 그린다", () => {
    const same = Float64Array.from({ length: 100 }, () => 5);
    const { calls } = render(
      input(
        {},
        {
          xs: Float64Array.from({ length: 100 }, (_, i) => (i < 50 ? 1 : 9)),
          ys: same,
          ids: Float64Array.from({ length: 100 }, (_, i) => i),
        },
      ),
    );
    // 두 자리에 50개씩 → 자리마다 3개
    expect(calls.arc).toBe(6);
  });

  it("점 글자는 적은 점에만 단다", () => {
    const { texts } = render(
      input({ pointLabel: { visible: true, suffix: "u" } }),
    );
    expect(texts.filter((t) => t.endsWith("u")).length).toBeGreaterThan(0);
  });

  it("제목을 숨기면 제목·요약을 그리지 않는다", () => {
    const { texts } = render(input({ title: { visible: false } }));
    expect(texts).not.toContain("item");
    expect(texts.some((t) => t.endsWith("pts"))).toBe(false);
  });
});
