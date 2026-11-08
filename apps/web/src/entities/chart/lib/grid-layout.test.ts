import { describe, expect, it } from "vitest";
import { detailSizeFor, itemSizeFor } from "./grid-layout";

describe("PNG 크기와 화면 배율·테마", () => {
  const area = { width: 1024, height: 768 };
  const grid = { rows: 2, cols: 2 };
  const plain = { pixelRatio: 1, theme: "light" } as const;

  it("배율이 1이고 light면 크기만 보낸다", () => {
    expect(itemSizeFor(area, grid, plain)).not.toHaveProperty("pixelRatio");
    expect(itemSizeFor(area, grid, plain)).not.toHaveProperty("theme");
    expect(detailSizeFor(area, plain)).toEqual({ width: 1022, height: 766 });
  });

  it("고해상도 화면이면 크기(CSS 픽셀)는 그대로 두고 배율을 붙인다", () => {
    const size = itemSizeFor(area, grid, { ...plain, pixelRatio: 2 });
    expect(size).toEqual({ ...itemSizeFor(area, grid, plain), pixelRatio: 2 });
    expect(detailSizeFor(area, { ...plain, pixelRatio: 1.5 })).toEqual({
      width: 1022,
      height: 766,
      pixelRatio: 1.5,
    });
  });

  it("다크 테마면 크기는 그대로 두고 theme을 붙인다", () => {
    expect(itemSizeFor(area, grid, { ...plain, theme: "dark" })).toEqual({
      ...itemSizeFor(area, grid, plain),
      theme: "dark",
    });
    expect(detailSizeFor(area, { pixelRatio: 2, theme: "dark" })).toEqual({
      width: 1022,
      height: 766,
      pixelRatio: 2,
      theme: "dark",
    });
  });
});
