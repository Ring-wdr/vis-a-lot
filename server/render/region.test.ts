import { describe, expect, it } from "vitest";
import {
  dimOutside,
  type Region,
  regionContains,
  regionTester,
} from "./region";

describe("regionContains", () => {
  it("사각형은 방향과 상관없이 경계를 포함한다", () => {
    const rect = { type: "rect", x0: 10, y0: 5, x1: 0, y1: 0 } as const;
    expect(regionContains(rect, 0, 0)).toBe(true);
    expect(regionContains(rect, 5, 2)).toBe(true);
    expect(regionContains(rect, 11, 2)).toBe(false);
  });

  it("자유형은 닫힌 다각형으로 본다", () => {
    // ㄱ자 모양: 오목한 부분은 바깥이다.
    const region: Region = {
      type: "lasso",
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 10],
        [5, 5],
        [0, 5],
      ],
    };
    expect(regionContains(region, 2, 2)).toBe(true);
    expect(regionContains(region, 7, 8)).toBe(true);
    expect(regionContains(region, 2, 8)).toBe(false);
    expect(regionTester(region)(2, 8)).toBe(false);
    expect(regionTester(region)(20, 2)).toBe(false);
  });
});

describe("dimOutside", () => {
  it("그림 영역에 선택 영역을 구멍으로 더해 even-odd로 한 번 칠한다", () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, key: string) =>
        key in t
          ? t[key]
          : (...args: unknown[]) => calls.push(`${key}(${args.join(",")})`),
      set: (t, key: string, value) => {
        t[key] = value;
        return true;
      },
    }) as unknown as OffscreenCanvasRenderingContext2D;
    const id = (v: number) => v;
    dimOutside(
      ctx,
      { type: "rect", x0: 10, y0: 10, x1: 20, y1: 30 },
      id,
      id,
      { left: 0, top: 0, width: 100, height: 50 },
      "#ffffff",
      0.8,
    );
    expect(calls).toEqual([
      "save()",
      "beginPath()",
      "rect(0,0,100,50)",
      "rect(10,10,10,20)",
      "fill(evenodd)",
      "restore()",
    ]);
    expect(ctx.globalAlpha).toBe(0.8);
    expect(ctx.fillStyle).toBe("#ffffff");
  });
});
