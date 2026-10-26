import { describe, expect, it } from "vitest";
import { drawLegendAround, framePlot, type LegendInput } from "./legend";
import { DEFAULT_OPTIONS, mergeOptions } from "./options";

/** 글자 하나를 7px로 재는 가짜 canvas */
const ctx = {
  font: "",
  save() {},
  restore() {},
  measureText: (text: string) => ({ width: text.length * 7 }),
} as unknown as OffscreenCanvasRenderingContext2D;

const legend = (position: LegendInput["position"]): LegendInput => ({
  title: "생산 라인",
  values: ["Line-Alpha-North", "Line-Beta-South"],
  colors: ["#000", "#111"],
  position,
});

describe("framePlot", () => {
  // scatter metadata는 plot 폭으로 픽셀 칸 번호를 매기므로 소수가 섞이면 점을 하나도 못 찾는다.
  it.each(["left", "right"] as const)(
    "%s legend가 폭 상한에 걸려도 그림 영역은 정수 픽셀이다",
    (position) => {
      for (const width of [227, 255, 301, 333]) {
        const plot = framePlot(ctx, width, 200, 20, legend(position));
        expect(Number.isInteger(plot.left)).toBe(true);
        expect(Number.isInteger(plot.width)).toBe(true);
      }
    },
  );
});

/** 그리기 호출을 받아 넘기는 가짜 canvas */
const drawCtx = new Proxy(
  {
    font: "",
    canvas: { width: 300, height: 200 },
    measureText: (text: string) => ({ width: text.length * 7 }),
  } as Record<string, unknown>,
  {
    get: (target, key: string) => (key in target ? target[key] : () => {}),
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  },
) as unknown as OffscreenCanvasRenderingContext2D;

describe("legend 모양", () => {
  const input: LegendInput = {
    title: "t",
    values: ["a", "b", "c"],
    colors: ["#000000", "#111111", "#222222"],
  };

  it("기본값이면 지금까지와 같은 그림 영역", () => {
    expect(framePlot(ctx, 300, 200, 20, input, DEFAULT_OPTIONS)).toEqual(
      framePlot(ctx, 300, 200, 20, input),
    );
    expect(framePlot(ctx, 300, 200, 20, input)).toEqual({
      left: 34,
      top: 54,
      width: 252,
      height: 120,
    });
  });

  it("뒤집어도 항목은 원래 인덱스를 가진다", () => {
    const o = mergeOptions(DEFAULT_OPTIONS, { legend: { reverse: true } });
    const plot = framePlot(drawCtx, 300, 200, 20, input, o);
    const meta = drawLegendAround(drawCtx, input, plot, 20, o);
    expect(meta.entries.map((e) => [e.value, e.index])).toEqual([
      ["c", 2],
      ["b", 1],
      ["a", 0],
    ]);
  });

  it("숨기면 자리를 두지 않고 빈 metadata", () => {
    const o = mergeOptions(DEFAULT_OPTIONS, { legend: { visible: false } });
    expect(framePlot(ctx, 300, 200, 20, input, o).top).toBe(28);
    const meta = drawLegendAround(
      drawCtx,
      input,
      { left: 0, top: 0, width: 1, height: 1 },
      20,
      o,
    );
    expect(meta.entries).toEqual([]);
  });

  it("panel 여백만큼 그림 영역이 줄어든다", () => {
    const o = mergeOptions(DEFAULT_OPTIONS, {
      panel: { margin: { top: 10, left: 5, right: 7, bottom: 3 } },
    });
    expect(framePlot(ctx, 300, 200, 20, undefined, o)).toEqual({
      left: 39,
      top: 38,
      width: 240,
      height: 133,
    });
  });

  it("화면이 DOM으로 다시 그릴 모양과 글자 자리를 metadata에 담는다", () => {
    const plot = framePlot(drawCtx, 300, 200, 20, input);
    const meta = drawLegendAround(drawCtx, input, plot, 20);
    expect(meta.layout).toMatchObject({
      orientation: "horizontal",
      fontSize: 11,
      marker: 5,
      title: { y: meta.box.y + meta.box.height / 2 },
    });
    expect(meta.layout?.more).toBeUndefined();
    const hidden = drawLegendAround(
      drawCtx,
      input,
      plot,
      20,
      mergeOptions(DEFAULT_OPTIONS, { legend: { visible: false } }),
    );
    expect(hidden.layout).toBeUndefined();
  });

  it("고해상도 캔버스(scale)에서도 오른쪽 legend 폭은 CSS 픽셀로 잰다", () => {
    const right = { ...input, position: "right" as const };
    const plot = framePlot(drawCtx, 300, 200, 20, right);
    const base = drawLegendAround(drawCtx, right, plot, 20);
    const scaled = new Proxy(drawCtx, {
      get: (target, key: string) =>
        key === "canvas"
          ? { width: 600, height: 400 }
          : key === "getTransform"
            ? () => ({ a: 2 })
            : Reflect.get(target, key),
    });
    const meta = drawLegendAround(scaled, right, plot, 20);
    expect(meta.box).toEqual(base.box);
    expect(meta.layout?.orientation).toBe("vertical");
  });
});
