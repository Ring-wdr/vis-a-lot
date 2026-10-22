import { describe, expect, it } from "vitest";
import { framePlot, type LegendInput } from "./legend";

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
  it.each([
    "left",
    "right",
  ] as const)("%s legend가 폭 상한에 걸려도 그림 영역은 정수 픽셀이다", (position) => {
    for (const width of [227, 255, 301, 333]) {
      const plot = framePlot(ctx, width, 200, 20, legend(position));
      expect(Number.isInteger(plot.left)).toBe(true);
      expect(Number.isInteger(plot.width)).toBe(true);
    }
  });
});
