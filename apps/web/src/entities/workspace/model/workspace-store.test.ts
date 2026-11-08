import { describe, expect, it } from "vitest";
import { modeSupported } from "./workspace-store";

describe("modeSupported", () => {
  it("기본 모드는 모든 차트에서 고른다", () => {
    expect(modeSupported("normal", { chartType: "bar" })).toBe(true);
  });

  it("차트 종류가 지원하지 않는 기능의 모드는 고르지 않는다", () => {
    expect(modeSupported("rectDelete", { chartType: "boxplot" })).toBe(false);
    expect(modeSupported("pan", { chartType: "sankey" })).toBe(false);
    expect(
      modeSupported("lassoDelete", { chartType: "line", subType: "ecdf" }),
    ).toBe(false);
  });
});
