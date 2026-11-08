// item의 지금 상태를 다시 그릴 때 덮어쓸 형태(ItemRestore)로 꺼낸다. history 기록과 공유가 같이 쓴다.

import type { ItemRestore } from "../api/types";
import type { ChartItem, ChartRecord } from "./chart-store";

export function itemRestore(item: ChartItem): ItemRestore {
  return {
    view: item.view,
    shapes: item.shapes,
    color: item.props?.color,
    legendColors: item.props?.legendColors,
    legendPosition: item.props?.legendPosition,
    hiddenLegend: item.props?.hiddenLegend,
    options: item.props?.options,
    selection: item.selection,
    favorites: item.favorites,
    legendGroups: item.legendGroups,
    deletions: item.deletions,
  };
}

/** 값이 없거나 빈 배열·빈 객체면 바뀌지 않은 것으로 본다. */
function isUnchanged(value: unknown) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** 바뀐 필드만 남긴다. 아무것도 바뀌지 않았으면 undefined */
export function changedRestore(restore: ItemRestore): ItemRestore | undefined {
  const changed: Partial<ItemRestore> = {};
  let any = false;
  for (const [field, value] of Object.entries(restore)) {
    if (isUnchanged(value)) continue;
    (changed as Record<string, unknown>)[field] = value;
    any = true;
  }
  return any ? { ...changed, shapes: restore.shapes } : undefined;
}

/** 차트의 item 중 바뀐 것만 키별로. 공유 링크처럼 짧게 담을 때 쓴다. */
export function chartRestore(chart: ChartRecord): Record<string, ItemRestore> {
  const restore: Record<string, ItemRestore> = {};
  for (const item of chart.items ?? []) {
    const changed = changedRestore(itemRestore(item));
    if (changed) restore[item.key] = changed;
  }
  return restore;
}
