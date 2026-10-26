import { describe, expect, it } from "vitest";
import { detailSizeFor, itemSizeFor } from "./grid-layout";

describe("PNG 크기와 화면 배율", () => {
  const area = { width: 1024, height: 768 };
  const grid = { rows: 2, cols: 2 };

  it("배율이 1이면 크기만 보낸다", () => {
    expect(itemSizeFor(area, grid, 1)).not.toHaveProperty("pixelRatio");
    expect(detailSizeFor(area, 1)).toEqual({ width: 1022, height: 766 });
  });

  it("고해상도 화면이면 크기(CSS 픽셀)는 그대로 두고 배율을 붙인다", () => {
    const size = itemSizeFor(area, grid, 2);
    expect(size).toEqual({ ...itemSizeFor(area, grid, 1), pixelRatio: 2 });
    expect(detailSizeFor(area, 1.5)).toEqual({
      width: 1022,
      height: 766,
      pixelRatio: 1.5,
    });
  });
});
