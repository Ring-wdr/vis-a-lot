import { describe, expect, it } from "vitest";
import { drawTitle } from "./frame";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "./options";
import { headerHeight, subtitleFont } from "./style";

type Text = { text: string; x: number; y: number; font: string; align: string };

/** fillText만 그때의 글꼴·정렬과 함께 기록하는 가짜 canvas */
function recorder() {
  const texts: Text[] = [];
  const state: Record<string, unknown> = { font: "", textAlign: "start" };
  const ctx = new Proxy(state, {
    get: (target, key: string) => {
      if (key === "measureText")
        return (text: string) => ({ width: text.length * 6 });
      if (key === "fillText")
        return (text: string, x: number, y: number) =>
          texts.push({
            text,
            x,
            y,
            font: String(target.font),
            align: String(target.textAlign),
          });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
  return { ctx, texts };
}

const opts = (patch: ChartOptionsPatch): ChartOptions =>
  mergeOptions<ChartOptions>(DEFAULT_OPTIONS, patch);
const plot = { left: 50, top: 40, width: 300, height: 200 };

function subtitleOf(o: ChartOptions) {
  const { ctx, texts } = recorder();
  drawTitle(ctx, plot, "item", ["요약"], o);
  const sub = texts.find((t) => t.text === "부제");
  if (!sub) throw new Error("부제목을 그리지 않았다");
  return sub;
}

describe("부제목", () => {
  it("크기·정렬을 정하지 않으면 제목 크기의 0.9배, 제목 정렬을 따른다", () => {
    const o = opts({ title: { subtitle: "부제", align: "center" } });
    expect(subtitleFont(o)).toBe(11);
    expect(subtitleOf(o)).toMatchObject({
      x: 200,
      align: "center",
      font: expect.stringMatching(/^11px /),
    });
  });

  it("정렬을 정하면 제목과 따로 놓는다. 오른쪽은 요약 폭만큼 비켜 둔다", () => {
    const o = opts({ title: { subtitle: "부제", subtitleAlign: "right" } });
    // 요약 "요약" 폭 12 + 8
    expect(subtitleOf(o)).toMatchObject({ x: 350 - 20, align: "right" });
    expect(
      subtitleOf(opts({ title: { subtitle: "부제", subtitleAlign: "left" } })),
    ).toMatchObject({ x: 50, align: "left" });
  });

  it("글자 크기는 size.fontAuto가 꺼져 있을 때만 쓰고, 제목 줄 높이도 따른다", () => {
    const auto = opts({ title: { subtitle: "부제", subtitleFontSize: 20 } });
    expect(subtitleFont(auto)).toBe(11);
    const manual = opts({
      title: { subtitle: "부제", subtitleFontSize: 20 },
      size: { fontAuto: false },
    });
    expect(subtitleFont(manual)).toBe(20);
    expect(subtitleOf(manual).font).toMatch(/^20px /);
    expect(headerHeight(manual) - headerHeight(auto)).toBe(20 - 11);
  });
});
