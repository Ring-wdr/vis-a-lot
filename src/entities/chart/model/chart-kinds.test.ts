import { describe, expect, it } from "vitest";
import { modeSupported } from "@/entities/workspace/model/workspace-store";
import { supports } from "./chart-kinds";

describe("chart kinds", () => {
  it("점 삭제는 점을 그리는 차트에서만 쓴다", () => {
    expect(supports("scatter", "delete")).toBe(true);
    expect(supports("line", "delete")).toBe(true);
    expect(supports("bar", "delete")).toBe(false);
    expect(modeSupported("rectDelete", "boxplot")).toBe(false);
  });

  it("기본 모드는 모든 차트, 그린 차트가 없으면 기능은 꺼진다", () => {
    expect(modeSupported("normal", "bar")).toBe(true);
    expect(supports(undefined, "pan")).toBe(false);
  });
});
