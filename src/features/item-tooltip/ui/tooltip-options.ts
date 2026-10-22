// 툴팁 모양 속성(tooltip 구역)을 화면 툴팁에 입히는 순수 함수. 툴팁은 서버가 그리지 않으므로 화면이 적용한다.

import type { CSSProperties } from "react";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  supportsOption,
  type TooltipOptions,
} from "@/entities/chart/model/chart-options";
import type { ChartType } from "@/shared/api/types";

/**
 * 기본값 → 공통 → item 개별로 합친 툴팁 속성. 차트가 툴팁 속성을 쓰지 않거나(boxplot)
 * 공통·개별 어디에도 정하지 않았으면 undefined: 지금 모양(테마 색, 다크 모드 포함)을 그대로 둔다.
 */
export function resolveTooltipOptions(
  chartType: ChartType | undefined,
  common: ChartOptionsPatch | undefined,
  item: ChartOptionsPatch | undefined,
): TooltipOptions | undefined {
  if (!supportsOption(chartType, "tooltip")) return undefined;
  if (!common?.tooltip && !item?.tooltip) return undefined;
  return mergeOptions<ChartOptions>(
    mergeOptions<ChartOptions>(DEFAULT_OPTIONS, common),
    item,
  ).tooltip;
}

const NUMBER = /^-?[\d,]*\d(\.\d+)?$/;

/** 값 글자에 소수 자리·앞뒤 글자를 입힌다. 값이 없음(—)이면 그대로 둔다. */
export function formatTooltipText(text: string, o: TooltipOptions) {
  if (text === "—") return text;
  let out = text;
  if (o.decimals !== null && NUMBER.test(text)) {
    const n = Number(text.replace(/,/g, ""));
    if (Number.isFinite(n))
      out = n.toLocaleString(undefined, {
        minimumFractionDigits: o.decimals,
        maximumFractionDigits: o.decimals,
      });
  }
  return `${o.prefix}${out}${o.suffix}`;
}

/** #rrggbb + 투명도(0 불투명..1 투명) → rgba */
export function withTransparency(hex: string, transparency: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const alpha = Math.round((1 - transparency) * 100) / 100;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function tooltipBoxStyle(o: TooltipOptions): CSSProperties {
  return {
    fontSize: o.fontSize,
    color: o.fontColor,
    background: withTransparency(o.background, o.transparency),
    borderRadius: o.round ? 6 : 0,
    border: o.border ? `1px solid ${o.borderColor}` : "none",
  };
}
