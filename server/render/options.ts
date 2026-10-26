// 차트 속성(옵션). 공통 속성·item 개별 속성은 이 모양의 부분 값(ChartOptionsPatch)을 저장하고,
// 그릴 때 기본값 → 공통 → 개별 순으로 합친 전체 값(ChartOptions)을 렌더러에 넘긴다.
// 차트 종류마다 쓸 수 있는 구역은 server/charts/chart-options.ts의 표가 정한다. 못 쓰는 구역은 기본값으로 온다.
// 렌더러는 Worker에서도 돌므로 이 파일은 아무것도 import하지 않는다.

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

const axis = (): AxisOptions => ({
  visible: true,
  title: { visible: false, text: "", color: "" },
  min: null,
  max: null,
  log: false,
  line: { visible: true, width: 1, color: "#c9c8c2" },
  grid: { visible: true, width: 1, color: "#e7e6e2" },
  tick: { visible: true, count: 5, length: 0, color: "#c9c8c2" },
  label: { visible: true, angle: 0, fontSize: 11, color: "#52514e" },
  decimals: null,
  dateFormat: "",
});

/** 지금까지 그리던 모습과 같은 기본값. 옵션을 하나도 정하지 않으면 PNG가 바뀌지 않아야 한다. */
export const DEFAULT_OPTIONS: ChartOptions = {
  title: {
    visible: true,
    text: "",
    subtitle: "",
    fontSize: 12,
    bold: true,
    color: "#0b0b0b",
    align: "left",
    subtitleColor: "#52514e",
    summary: { visible: true, color: "#8a8984" },
  },
  // 지금까지 x축은 세로 그리드 없이 아래 축 선만, y축은 가로 그리드만 그렸다.
  axes: {
    x: { ...axis(), grid: { ...axis().grid, visible: false } },
    y: { ...axis(), line: { ...axis().line, visible: false } },
  },
  legend: {
    visible: true,
    border: true,
    borderColor: "#e7e6e2",
    reverse: false,
    fontSize: 11,
    fontColor: "#52514e",
    titleColor: "#8a8984",
  },
  panel: {
    backColor: "#fcfcfb",
    gradient: false,
    border: false,
    borderColor: "#c9c8c2",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  palette: {
    gradient: false,
    start: "#cfe3fa",
    middle: "",
    end: "#0d3d78",
    steps: 0,
    reverse: false,
    othersColor: "#a9a8a2",
  },
  shape: {
    type: "circle",
    style: "both",
    transparency: 0,
    borderWidth: 0,
    borderColor: "",
    dimOpacity: 0.2,
    cornerRadius: 4,
    medianColor: "#0b0b0b",
  },
  size: {
    pointAuto: true,
    pointFixed: 4,
    pointMin: 1,
    pointMax: 12,
    fontAuto: true,
    fontMin: 9,
    fontMax: 16,
    lineWidth: 1.5,
  },
  pointLabel: {
    visible: false,
    position: "top",
    angle: 0,
    fontSize: 10,
    color: "#52514e",
    prefix: "",
    suffix: "",
    decimals: null,
    box: { visible: false, background: "#ffffff", border: "#c9c8c2" },
  },
  score: {
    visible: false,
    kinds: ["rscore"],
    ucl: null,
    lcl: null,
    fontSize: 11,
    fontColor: "#0b0b0b",
    backColor: "#ffffff",
    borderColor: "#c9c8c2",
    borderWidth: 1,
  },
  prediction: {
    enabled: false,
    method: "sma",
    period: 10,
    showInterval: false,
    description: true,
    window: 5,
    alpha: null,
    beta: null,
    gamma: null,
    seasonLength: 12,
    trend: "additive",
    seasonal: "additive",
    damped: false,
  },
  value: {
    nullNumeric: null,
    outlier: false,
    outlierMethod: "iqr",
    outlierK: 1.5,
  },
  focus: {
    enabled: false,
    target: "y",
    operator: ">",
    value: 0,
    color: "#e34948",
    shape: "circle",
    size: 6,
    legendSingleColor: false,
  },
  tooltip: {
    title: "",
    fontSize: 12,
    fontColor: "#0b0b0b",
    background: "#ffffff",
    transparency: 0,
    round: true,
    border: true,
    borderColor: "#c9c8c2",
    prefix: "",
    suffix: "",
    decimals: null,
  },
  expression: { x: "", y: "" },
};

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

/** 옵션이 없는 입력(테스트, 예전 호출)은 기본값으로 그린다. */
export function optionsOf(input: { options?: ChartOptions }): ChartOptions {
  return input.options ?? DEFAULT_OPTIONS;
}
