import { describe, expect, it } from "vitest";
import {
  LAYOUT_PRESETS,
  presetLayout,
} from "@/entities/workspace/lib/layout-presets";
import {
  leaf,
  setSplitRatios,
  split,
} from "@/entities/workspace/lib/layout-tree";
import { matchingPreset } from "./match-preset";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe("matchingPreset", () => {
  it("preset을 적용한 레이아웃은 그 preset이다", () => {
    for (const p of LAYOUT_PRESETS)
      expect(matchingPreset(presetLayout(p.id, ids(p.panels)))).toBe(p.id);
  });

  it("크기를 바꾸거나 preset에 없는 모양이면 없다", () => {
    const resized = setSplitRatios(presetLayout("1x2", ids(2)), [], [0.3, 0.7]);
    expect(matchingPreset(resized)).toBeUndefined();
    const odd = split("horizontal", [
      leaf("a"),
      split("vertical", [leaf("b"), leaf("c"), leaf("d"), leaf("e")]),
    ]);
    expect(matchingPreset(odd)).toBeUndefined();
  });
});
