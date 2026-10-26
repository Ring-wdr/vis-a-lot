// 차트 기본값의 한 곳. draw(속성 합치기)와 화면(전체 설정·item 속성 팝업·새 탭 draft)이 모두 이 값을 쓴다.
// 화면은 GET /api/chart/defaults로 받는다. 원래 제품은 어드민 페이지에서 정한 값을 쓰는데,
// 그 전까지는 서버에 고정해 둔다. 어드민 값이 생기면 이 모듈만 바꾸면 된다.
// 모든 차트에 쓰는 값을 두고, 다크 테마면 themes.dark를, 차트 종류마다 다른 값은 charts[type]을 덮어쓴다 (defaultsFor).

import type { ChartTheme, ChartType } from "../api/types";
import type { LegendPosition } from "../render/legend";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DARK_OPTIONS,
  DEFAULT_OPTIONS,
  mergeOptions,
} from "../render/options";
import { DEFAULT_SERIES_COLOR } from "../render/theme";

/** 차트 종류 하나가 전체 기본값과 다르게 쓰는 값. 적지 않은 값은 전체 기본값을 따른다. */
export type ChartTypeDefaults = {
  legendPosition?: LegendPosition;
  /** 전체 options 위, 공통 속성 아래에 덮어쓴다. */
  options?: ChartOptionsPatch;
};

export type ChartDefaults = {
  /** 차트 속성 전체 값(light 테마). 테마별 값·차트 종류별 값·공통·item 개별 속성은 이 위에 덮어쓴다. */
  options: ChartOptions;
  /** light가 아닌 테마에서 전체 값 위에 덮는 값. 글자·바탕 계열 색만 있다. */
  themes: { dark: ChartOptionsPatch };
  /** 새 차트의 공통 속성 */
  common: { color: string };
  /** split 조합 이름을 잇는 문자 */
  splitSeparator: string;
  /** 공통·개별 속성에 legend 위치가 없을 때의 위치 */
  legendPosition: LegendPosition;
  /** 차트 종류별로 다른 값만 */
  charts: Partial<Record<ChartType, ChartTypeDefaults>>;
};

export const CHART_DEFAULTS: ChartDefaults = {
  options: DEFAULT_OPTIONS,
  themes: { dark: DARK_OPTIONS },
  common: { color: DEFAULT_SERIES_COLOR },
  splitSeparator: "-",
  legendPosition: "top",
  charts: {
    // 단계 이름이 길어 오른쪽 세로 목록으로 둔다.
    funnel: { legendPosition: "right" },
    // 선 굵기(size.lineWidth): 렌더러가 따로 쓰던 굵기를 옮겨 설정 창에도 그린 값이 보이게 한다.
    // radar는 다각형 테두리가 면 사이에서 보이게 굵게, 나머지는 심지·잇는 점선·가장 가는 흐름이라 가늘게
    radar: { options: { size: { lineWidth: 2 } } },
    candle: { options: { size: { lineWidth: 1 } } },
    waterfall: { options: { size: { lineWidth: 1 } } },
    sankey: { options: { size: { lineWidth: 1 } } },
  },
};

/** 차트 종류 하나에 쓰는 기본값: 전체 값 위에 테마별 값, 그 위에 charts[type]을 덮는다. */
export function defaultsFor(
  type: ChartType,
  theme: ChartTheme = "light",
  defaults: ChartDefaults = CHART_DEFAULTS,
): { legendPosition: LegendPosition; options: ChartOptions } {
  const own = defaults.charts[type];
  const base =
    theme === "light"
      ? defaults.options
      : mergeOptions<ChartOptions>(defaults.options, defaults.themes[theme]);
  return {
    legendPosition: own?.legendPosition ?? defaults.legendPosition,
    options: mergeOptions<ChartOptions>(base, own?.options),
  };
}
