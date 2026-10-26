// 차트 기본값의 한 곳. draw(속성 합치기)와 화면(전체 설정·item 속성 팝업·새 탭 draft)이 모두 이 값을 쓴다.
// 화면은 GET /api/chart/defaults로 받는다. 원래 제품은 어드민 페이지에서 정한 값을 쓰는데,
// 그 전까지는 서버에 고정해 둔다. 어드민 값이 생기면 이 모듈만 바꾸면 된다.

import { type ChartOptions, DEFAULT_OPTIONS } from "../render/options";
import { DEFAULT_SERIES_COLOR } from "../render/theme";

export type ChartDefaults = {
  /** 차트 속성 전체 값. 공통·item 개별 속성은 이 위에 덮어쓴다. */
  options: ChartOptions;
  /** 새 차트의 공통 속성 */
  common: { color: string };
  /** split 조합 이름을 잇는 문자 */
  splitSeparator: string;
};

export const CHART_DEFAULTS: ChartDefaults = {
  options: DEFAULT_OPTIONS,
  common: { color: DEFAULT_SERIES_COLOR },
  splitSeparator: "-",
};
