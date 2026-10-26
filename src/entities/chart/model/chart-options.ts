// 차트 속성(옵션)의 화면 쪽 모양. 화면은 @server를 import하지 않으므로 server/render/options.ts(모양)와
// server/charts/chart-options.ts(차트 종류별로 쓸 수 있는 구역)를 그대로 옮겨 둔다. 둘 중 하나를 고치면 여기도 고친다
// (chart-options.test.ts가 서버 값과 같은지 확인한다). 기본값은 사본을 두지 않고 서버에서 받는다(useDefaultOptions).

import { useMemo } from "react";
import { useChartDefaults } from "@/shared/api/queries";
import type {
  ChartDefaults,
  ChartTheme,
  ChartType,
  LegendPosition,
} from "@/shared/api/types";
import { useColorScheme } from "@/shared/lib/color-scheme";

export const OPTION_SECTIONS = [
  "title",
  "axes",
  "legend",
  "panel",
  "palette",
  "shape",
  "size",
  "pointLabel",
  "score",
  "prediction",
  "value",
  "focus",
  "tooltip",
  "expression",
] as const;
export type OptionSection = (typeof OPTION_SECTIONS)[number];

export type TextAlign = "left" | "center" | "right";

export type TitleOptions = {
  visible: boolean;
  /** 비우면 split 조합 이름(item label) */
  text: string;
  subtitle: string;
  /** size.fontAuto가 꺼져 있을 때만 쓴다. */
  fontSize: number;
  bold: boolean;
  color: string;
  align: TextAlign;
  subtitleColor: string;
  /** 오른쪽 요약(점 수·범주 수 등) */
  summary: { visible: boolean; color: string };
};

export type AxisOptions = {
  visible: boolean;
  title: {
    visible: boolean;
    /** 비우면 컬럼 라벨 */
    text: string;
    /** 비우면 눈금 글자 색 */
    color: string;
  };
  /** 값 축 범위. null이면 자동 */
  min: number | null;
  max: number | null;
  /** 로그 축. 양수 값 축에서만 쓴다. */
  log: boolean;
  line: { visible: boolean; width: number; color: string };
  grid: { visible: boolean; width: number; color: string };
  /** count는 눈금 개수 힌트, length는 눈금 선 길이(0이면 그리지 않는다) */
  tick: { visible: boolean; count: number; length: number; color: string };
  label: {
    visible: boolean /** 도 단위 */;
    angle: number;
    fontSize: number;
    color: string;
  };
  /** 숫자 눈금의 소수 자리. null이면 자동 */
  decimals: number | null;
  /** 시계열 눈금 형식(d3-time-format). 비우면 범위에 맞춰 자동 */
  dateFormat: string;
};

export type LegendStyle = {
  visible: boolean;
  border: boolean;
  borderColor: string;
  /** 항목 순서를 뒤집는다. */
  reverse: boolean;
  fontSize: number;
  fontColor: string;
  titleColor: string;
};

export type PanelOptions = {
  backColor: string;
  /** 배경을 위→아래로 옅어지는 그라데이션으로 */
  gradient: boolean;
  border: boolean;
  borderColor: string;
  /** PNG 가장자리와 차트 사이 여백(px) */
  margin: { top: number; right: number; bottom: number; left: number };
};

export type PaletteOptions = {
  /** legend 값 색을 시작→(중간)→끝 그라데이션 단계로 */
  gradient: boolean;
  start: string;
  /** 비우면 시작·끝 두 색만 */
  middle: string;
  end: string;
  /** 단계 수. 0이면 legend 값 수 */
  steps: number;
  reverse: boolean;
  /** 팔레트에 들지 못한 나머지('기타' 조각)와 강조 시 나머지 색 */
  othersColor: string;
};

export const POINT_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
] as const;
export type PointShape = (typeof POINT_SHAPES)[number];

export type ShapeOptions = {
  type: PointShape;
  /** both: 채우기 + 테두리, border: 테두리만, brush: 채우기만 */
  style: "both" | "border" | "brush";
  /** 0(불투명)..1(투명). 기본 0이라 모든 차트가 불투명하게 그린다. */
  transparency: number;
  /** 도형(막대·조각·점) 테두리 굵기 */
  borderWidth: number;
  /** 도형 테두리 색. 비우면 자동(도형 색을 진하게, 굵기를 정했으면 배경색) */
  borderColor: string;
  /** 선택 영역 밖 도형의 진하기 (0..1) */
  dimOpacity: number;
  /** 막대 끝 모서리 둥글기(px) */
  cornerRadius: number;
  /** boxplot 중앙값 선 색 */
  medianColor: string;
};

export type SizeOptions = {
  /** 점 크기 자동. 끄면 pointFixed */
  pointAuto: boolean;
  pointFixed: number;
  pointMin: number;
  pointMax: number;
  /** 글자 크기 자동: item 크기에 맞춰 fontMin..fontMax 사이로. 끄면 각 구역의 fontSize */
  fontAuto: boolean;
  fontMin: number;
  fontMax: number;
  /** 선 굵기 (line 계열, radar 다각형, 연결선) */
  lineWidth: number;
};

export type PointLabelOptions = {
  visible: boolean;
  position: "top" | "center" | "bottom";
  angle: number;
  fontSize: number;
  color: string;
  prefix: string;
  suffix: string;
  /** null이면 자동 */
  decimals: number | null;
  box: { visible: boolean; background: string; border: string };
};

export const SCORE_KINDS = ["rscore", "fscore", "zscore", "cpk"] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

export type ScoreOptions = {
  visible: boolean;
  /** 보여줄 점수 (순서대로 상자에 적는다) */
  kinds: ScoreKind[];
  /** zscore, cpk의 상·하한. null이면 그 점수는 계산하지 않는다. */
  ucl: number | null;
  lcl: number | null;
  fontSize: number;
  fontColor: string;
  backColor: string;
  borderColor: string;
  borderWidth: number;
};

export const PREDICTION_METHODS = ["sma", "ses", "des", "holtWinters"] as const;
export type PredictionMethod = (typeof PREDICTION_METHODS)[number];

export type PredictionOptions = {
  enabled: boolean;
  method: PredictionMethod;
  /** 예측할 점 수 */
  period: number;
  /** 신뢰 구간(±1.96σ)을 띠로 */
  showInterval: boolean;
  /** 방법과 매개변수를 글자로 */
  description: boolean;
  /** sma 이동 평균 길이 */
  window: number;
  /** null이면 자동(오차 제곱합 최소) */
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  /** holtWinters 계절 길이 */
  seasonLength: number;
  trend: "additive" | "multiplicative";
  seasonal: "additive" | "multiplicative";
  damped: boolean;
};

export type ValueOptions = {
  /** 빈 칸(그 조합에 값이 없음)을 이 값으로 그린다. null이면 비워 둔다. */
  nullNumeric: number | null;
  /** 이상치를 빼고 그린다. */
  outlier: boolean;
  outlierMethod: "iqr" | "sigma";
  /** iqr: Q1 - k·IQR .. Q3 + k·IQR, sigma: 평균 ± k·σ */
  outlierK: number;
};

export const FOCUS_OPERATORS = [">", ">=", "<", "<=", "=", "!="] as const;
export type FocusOperator = (typeof FOCUS_OPERATORS)[number];

export type FocusOptions = {
  enabled: boolean;
  target: "x" | "y";
  operator: FocusOperator;
  value: number;
  color: string;
  /** 조건에 맞는 점의 모양·크기 (점 차트) */
  shape: PointShape;
  size: number;
  /** 조건에 맞지 않는 점을 legend 색 대신 회색 한 가지로 */
  legendSingleColor: boolean;
};

export type TooltipOptions = {
  /** 비우면 item 이름 */
  title: string;
  fontSize: number;
  fontColor: string;
  background: string;
  /** 0..1 */
  transparency: number;
  round: boolean;
  border: boolean;
  borderColor: string;
  prefix: string;
  suffix: string;
  /** null이면 자동 */
  decimals: number | null;
};

export type ExpressionOptions = {
  /** x 값에 적용할 식. 변수 x, y와 + - * / ^, abs log ln sqrt exp round min max. 비우면 그대로 */
  x: string;
  y: string;
};

export type ChartOptions = {
  title: TitleOptions;
  axes: { x: AxisOptions; y: AxisOptions };
  legend: LegendStyle;
  panel: PanelOptions;
  palette: PaletteOptions;
  shape: ShapeOptions;
  size: SizeOptions;
  pointLabel: PointLabelOptions;
  score: ScoreOptions;
  prediction: PredictionOptions;
  value: ValueOptions;
  focus: FocusOptions;
  tooltip: TooltipOptions;
  expression: ExpressionOptions;
};

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** 공통·개별 속성에 저장하는 부분 값. 적지 않은 필드는 아래 단계 값을 따른다. */
export type ChartOptionsPatch = DeepPartial<ChartOptions>;

/**
 * 차트 종류 하나에 쓰는 기본값: 전체 값 위에 테마별 값, 그 위에 charts[type]을 덮는다. 서버 defaultsFor와 같은 규칙이다.
 * 종류를 모르면 전체 값(과 테마별 값)이다.
 */
export function chartTypeDefaults(
  defaults: ChartDefaults,
  type: ChartType | undefined,
  theme: ChartTheme = "light",
): { legendPosition: LegendPosition; options: ChartOptions } {
  const own = type ? defaults.charts[type] : undefined;
  // 응답 스키마는 저장용 부분 값 모양이지만, 전체 options는 모든 필드가 채워져 있다.
  const all = defaults.options as ChartOptions;
  const base =
    theme === "light"
      ? all
      : mergeOptions<ChartOptions>(
          all,
          defaults.themes[theme] as ChartOptionsPatch,
        );
  return {
    legendPosition: own?.legendPosition ?? defaults.legendPosition,
    options: mergeOptions<ChartOptions>(
      base,
      own?.options as ChartOptionsPatch | undefined,
    ),
  };
}

/**
 * 서버가 정한 그 차트 종류의 기본값(GET /defaults의 options 위에 charts[type].options). 서버 draw도
 * 같은 값 위에 공통·개별 속성을 덮어쓰므로 전체 설정·item 속성 팝업의 '기본값'과 그려지는 모습이 늘 같다.
 * 지금 화면 테마의 값이다 (다크면 글자·바탕 계열 색이 다크 값). SessionScope가 받아 둔 뒤에 쓴다.
 */
export function useDefaultOptions(type: ChartType | undefined): ChartOptions {
  const defaults = useChartDefaults();
  const theme = useColorScheme();
  return useMemo(
    () => chartTypeDefaults(defaults, type, theme).options,
    [defaults, type, theme],
  );
}

/**
 * 공통 속성에 legend 위치가 없을 때 그 차트가 legend를 놓는 위치. 서버 기본값(GET /defaults)의
 * 전체 위치 위에 차트 종류별 위치를 덮은 값이고, 서버 draw도 같은 값을 쓴다.
 */
export function useDefaultLegendPosition(
  type: ChartType | undefined,
): LegendPosition {
  return chartTypeDefaults(useChartDefaults(), type).legendPosition;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** base 위에 patch를 깊게 덮는다. 배열과 null은 통째로 바꾸고, undefined는 건너뛴다. */
export function mergeOptions<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] =
      isPlainObject(value) && isPlainObject(out[key])
        ? mergeOptions(out[key], value)
        : value;
  }
  return out as T;
}

const ALL = OPTION_SECTIONS;
const without = (...omit: OptionSection[]) =>
  ALL.filter((s) => !omit.includes(s));

/**
 * 원본 표 대비 차이
 * - Wafer, Selection, Multi Axis: 해당 차트·기능이 없어 구역 자체를 두지 않는다.
 * - Axes: pie·treemap·funnel은 원본 O지만 축을 그리지 않는 차트라 X.
 * - Color(legend 모양): 원본 표의 Color 행을 legend 구역으로 본다.
 */
export const OPTION_SUPPORT: Record<ChartType, readonly OptionSection[]> = {
  scatter: ALL,
  line: ALL,
  bar: without("score", "prediction"),
  boxplot: without("score", "prediction", "tooltip", "expression"),
  histogram: without("score", "prediction", "focus", "expression"),
  pie: without("axes", "score", "prediction", "focus", "expression"),
  gantt: without("score", "prediction", "expression"),
  treemap: without("axes", "score", "prediction", "focus", "expression"),
  heatmap: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  candle: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "value",
    "expression",
  ),
  waterfall: without(
    "legend",
    "shape",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  funnel: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  radar: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
  sankey: without(
    "axes",
    "pointLabel",
    "score",
    "prediction",
    "focus",
    "expression",
  ),
};

export function supportsOption(
  type: ChartType | undefined,
  section: OptionSection,
) {
  return type !== undefined && OPTION_SUPPORT[type].includes(section);
}
