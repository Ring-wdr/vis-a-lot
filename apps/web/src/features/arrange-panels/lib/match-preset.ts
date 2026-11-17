import {
  LAYOUT_PRESETS,
  type LayoutPresetId,
  presetLayout,
} from "@/entities/workspace/lib/layout-presets";
import {
  type LayoutNode,
  panelIdsOf,
} from "@/entities/workspace/lib/layout-tree";

/** 비율이 같다고 볼 오차 (저장 검증과 같은 1e-3) */
const EPSILON = 1e-3;

function sameShape(a: LayoutNode, b: LayoutNode): boolean {
  if (a.type === "leaf" || b.type === "leaf")
    return a.type === "leaf" && b.type === "leaf" && a.panelId === b.panelId;
  return (
    a.direction === b.direction &&
    a.children.length === b.children.length &&
    a.ratios.every((r, i) => Math.abs(r - b.ratios[i]) < EPSILON) &&
    a.children.every((child, i) => sameShape(child, b.children[i]))
  );
}

/** 지금 레이아웃과 모양·비율이 같은 preset. 없으면(옮기거나 크기를 바꾼 뒤) undefined */
export function matchingPreset(layout: LayoutNode): LayoutPresetId | undefined {
  const ids = panelIdsOf(layout);
  return LAYOUT_PRESETS.find(
    (p) =>
      p.panels === ids.length && sameShape(presetLayout(p.id, ids), layout),
  )?.id;
}
