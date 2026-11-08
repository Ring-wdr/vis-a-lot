// item 개별 속성 바꾸기. 한 가지씩 바꾸는 요청(item 툴바·legend 체크박스)과
// item 속성 팝업에서 확인을 눌러 한 번에 보내는 요청이 같은 규칙을 쓴다.

import type { ChartType, ItemProps } from "../api/types";
import type { LegendPosition } from "../render/legend";
import type { ChartOptionsPatch } from "../render/options";
import { pickSupported } from "./chart-options";

/** 있는 것만 바꾼다. null은 공통 속성을 따르도록 되돌린다. */
export type ItemPropChanges = {
  /** null이면 legend 값별 색까지 모두 되돌린다. legendColors보다 먼저 적용한다. */
  color?: string | null;
  /** legend 값별 색. 값이 null이면 그 값만 되돌린다. */
  legendColors?: Record<string, string | null>;
  legendPosition?: LegendPosition | null;
  /** 차트 속성 전체. 차트가 쓰지 않는 구역은 버린다. */
  options?: ChartOptionsPatch | null;
  /** legend 체크박스: 값 하나를 보이거나 숨긴다. */
  legendVisible?: { value: string; visible: boolean };
};

export function applyItemChanges(
  current: ItemProps | undefined,
  changes: ItemPropChanges,
  chartType: ChartType,
): ItemProps | undefined {
  const props: ItemProps = { ...current };
  if (changes.color === null) {
    props.color = undefined;
    props.legendColors = undefined;
  } else if (changes.color !== undefined) {
    props.color = changes.color;
  }
  if (changes.legendColors) {
    const legendColors = { ...props.legendColors };
    for (const [value, color] of Object.entries(changes.legendColors)) {
      if (color === null) delete legendColors[value];
      else legendColors[value] = color;
    }
    props.legendColors = Object.keys(legendColors).length
      ? legendColors
      : undefined;
  }
  if (changes.legendPosition !== undefined) {
    props.legendPosition = changes.legendPosition ?? undefined;
  }
  if (changes.options !== undefined) {
    props.options = pickSupported(chartType, changes.options ?? undefined);
  }
  if (changes.legendVisible) {
    const { value, visible } = changes.legendVisible;
    const hidden = new Set(props.hiddenLegend);
    if (visible) hidden.delete(value);
    else hidden.add(value);
    props.hiddenLegend = hidden.size ? [...hidden] : undefined;
  }
  return propsOrNone(props);
}

/** 정한 것이 하나도 없으면 undefined (공통 속성을 그대로 따른다) */
export function propsOrNone(props: ItemProps): ItemProps | undefined {
  return props.color ||
    props.legendColors ||
    props.legendPosition ||
    props.hiddenLegend?.length ||
    props.options
    ? props
    : undefined;
}
