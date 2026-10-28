// 차트 속성(옵션) 편집 화면의 필드 표. 구역마다 필드 설명(라벨, 경로, 입력 종류)을 두고
// 한 컴포넌트(OptionSectionForm)가 그린다. 경로는 ChartOptions 기준 점 표기("title.text")다.
// 라벨이 화면 언어를 따르므로 표는 언어마다 한 번 만들어 둔다 (sectionFields() 등).

import {
  type ChartOptions,
  type ChartOptionsPatch,
  FOCUS_OPERATORS,
  type OptionSection,
  POINT_SHAPES,
} from "@/entities/chart/model/chart-options";
import { defineMessages, getLocale, type Locale } from "@/shared/lib/i18n";

type Choice = { value: string; label: string };

type Base = {
  path: string;
  label: string;
  /** 다른 값에 따라 보일 때만 (예: 예측 방법별 매개변수) */
  when?: (o: ChartOptions) => boolean;
};

export type OptionField =
  | (Base & { kind: "boolean" })
  | (Base & {
      kind: "number";
      min: number;
      max: number;
      step?: number;
      /** 비우면 null(자동) */
      nullable?: boolean;
    })
  | (Base & { kind: "color" /** 비우기("")를 허용 */; optional?: boolean })
  | (Base & { kind: "select"; options: readonly Choice[] })
  | (Base & { kind: "multi"; options: readonly Choice[] })
  | (Base & { kind: "text"; maxLength: number; placeholder?: string })
  | { kind: "heading"; label: string; when?: (o: ChartOptions) => boolean };

/** 필드가 많아 하위 메뉴로 나눠 보이는 구역. 메뉴에서 구역 아래에 하위 항목으로 붙는다. */
export type SectionPart = { id: string; label: string; fields: OptionField[] };

const messages = defineMessages({
  ko: {
    section: {
      title: "제목",
      axes: "축",
      legend: "범례",
      panel: "패널",
      palette: "팔레트",
      shape: "모양",
      size: "크기",
      pointLabel: "점 라벨",
      score: "점수",
      prediction: "예측",
      value: "값",
      focus: "강조",
      tooltip: "툴팁",
      expression: "식",
    } as Record<OptionSection, string>,
    hint: {
      title: "글자 크기는 크기 › 글자 크기 자동을 끈 때만 씁니다.",
      axes: "글자 크기는 크기 › 글자 크기 자동을 끈 때만 씁니다. 로그 축은 양수 값 축에서만 적용됩니다.",
      score:
        "상관계수: x·y 상관계수, 분산분석 F: 범례 그룹 간 일원 분산분석 F, 규격 내 확률: 값이 하한~상한 안에 들 확률, 공정 능력: Cpk. 이 둘은 상한·하한이 있어야 계산합니다.",
      value: "빈 칸 값은 그 조합에 데이터가 없는 칸에 씁니다.",
      focus: "조건에 맞는 점(막대)을 강조합니다.",
      expression:
        "변수 x, y와 + - * / ^, 함수 abs log ln sqrt exp round floor ceil min max pow를 씁니다. 예: log(y), x * 2 + 1. 비우면 원래 값입니다.",
    } as Partial<Record<OptionSection, string>>,
    left: "왼쪽",
    center: "가운데",
    right: "오른쪽",
    top: "위",
    bottom: "아래",
    circle: "원",
    square: "사각형",
    triangle: "삼각형",
    diamond: "마름모",
    cross: "십자",
    xAxis: "X축",
    yAxis: "Y축",
    showAxis: "축 보이기",
    showAxisTitle: "축 제목 보이기",
    axisTitle: "축 제목",
    axisTitlePlaceholder: "비우면 컬럼 이름",
    axisTitleColor: "축 제목 색 (비우면 눈금 글자 색)",
    min: "최솟값",
    max: "최댓값",
    logAxis: "로그 축",
    showAxisLine: "축 선 보이기",
    axisLineWidth: "축 선 굵기",
    axisLineColor: "축 선 색",
    showGrid: "그리드 보이기",
    gridWidth: "그리드 굵기",
    gridColor: "그리드 색",
    showTicks: "눈금 보이기",
    tickCount: "눈금 개수",
    tickLength: "눈금 길이",
    tickColor: "눈금 색",
    showTickLabels: "눈금 글자 보이기",
    tickLabelAngle: "눈금 글자 각도",
    tickLabelSize: "눈금 글자 크기",
    tickLabelColor: "눈금 글자 색",
    decimals: "소수 자리",
    dateFormat: "날짜 형식",
    dateFormatPlaceholder: "예: %m/%d %H:%M · 비우면 자동",
    showTitle: "제목 보이기",
    title: "제목",
    titlePlaceholder: "비우면 split 조합 이름",
    subtitle: "부제목",
    subtitleColor: "부제목 색",
    fontSize: "글자 크기",
    bold: "굵게",
    fontColor: "글자 색",
    align: "정렬",
    summaryHeading: "요약 (오른쪽 점 수·범주 수)",
    showSummary: "요약 보이기",
    summaryColor: "요약 글자 색",
    showLegend: "범례 보이기",
    showBorder: "테두리 보이기",
    borderColor: "테두리 색",
    reverseOrder: "순서 뒤집기",
    titleColor: "제목 색",
    backColor: "배경 색",
    gradient: "그라데이션",
    border: "테두리",
    margin: "여백",
    useGradient: "그라데이션 색 쓰기",
    startColor: "시작 색",
    middleColor: "중간 색",
    endColor: "끝 색",
    steps: "단계 수 (0이면 범례 값 수)",
    reverseColors: "색 순서 뒤집기",
    othersColor: "기타 색 ('기타' 조각, 강조 시 나머지)",
    defaultShape: "기본 모양",
    shapeStyle: "적용",
    fillAndBorder: "채우기 + 테두리",
    borderOnly: "테두리만",
    fillOnly: "채우기만",
    shapeTransparency: "투명도 (0 = 불투명)",
    borderWidth: "테두리 굵기",
    borderColorAuto: "테두리 색 (비우면 자동)",
    dimOpacity: "선택 밖 진하기",
    cornerRadius: "막대 모서리 둥글기",
    medianColor: "중앙값 선 색 (boxplot)",
    pointSize: "점 크기",
    auto: "자동",
    fixedSize: "고정 크기",
    sizeMin: "최소",
    sizeMax: "최대",
    line: "선",
    lineWidth: "선 굵기",
    showPointLabels: "점 라벨 보이기",
    position: "위치",
    angle: "각도",
    prefix: "앞 글자",
    suffix: "뒤 글자",
    box: "상자",
    showBox: "상자 보이기",
    showScores: "점수 보이기",
    scoreKinds: "점수 목록",
    rscore: "상관계수 (r)",
    fscore: "분산분석 F",
    zscore: "규격 내 확률 (z)",
    cpk: "공정 능력 (Cpk)",
    ucl: "상한",
    lcl: "하한",
    boxBackColor: "상자 배경 색",
    boxBorderColor: "상자 테두리 색",
    boxBorderWidth: "상자 테두리 굵기",
    showPrediction: "예측 보이기",
    method: "방법",
    sma: "단순 이동 평균",
    ses: "단순 지수 평활",
    des: "이중 지수 평활",
    holtWinters: "홀트-윈터스 지수 평활",
    period: "예측 개수",
    showInterval: "신뢰 구간",
    showDescription: "설명 보이기",
    window: "이동 평균 길이",
    alpha: "수준 계수 α (비우면 자동)",
    beta: "추세 계수 β (비우면 자동)",
    gamma: "계절 계수 γ (비우면 자동)",
    trend: "추세 방식",
    additive: "덧셈",
    multiplicative: "곱셈",
    seasonLength: "계절 길이",
    seasonal: "계절 방식",
    damped: "감쇠",
    nullNumeric: "빈 칸 값 (비우면 그리지 않음)",
    outlier: "이상치 빼기",
    outlierMethod: "이상치 방식",
    sigma: "정규분포 (평균 ± k·σ)",
    useFocus: "강조 쓰기",
    target: "대상",
    xValue: "x 값",
    yValue: "y 값",
    condition: "조건",
    value: "값",
    color: "색",
    shape: "모양",
    size: "크기",
    legendSingleColor: "나머지는 한 가지 색",
    tooltipTitlePlaceholder: "비우면 제목 없음",
    transparency: "투명도",
    round: "둥근 모서리",
    exprX: "X 값",
    exprY: "Y 값",
    exprXPlaceholder: "예: x * 2",
    exprYPlaceholder: "예: log(y)",
  },
  en: {
    section: {
      title: "Title",
      axes: "Axes",
      legend: "Legend",
      panel: "Panel",
      palette: "Palette",
      shape: "Shape",
      size: "Size",
      pointLabel: "Point labels",
      score: "Scores",
      prediction: "Forecast",
      value: "Values",
      focus: "Highlight",
      tooltip: "Tooltip",
      expression: "Expression",
    },
    hint: {
      title: "Font size applies only when Size › Font size Auto is off.",
      axes: "Font size applies only when Size › Font size Auto is off. Log scale applies only to axes with positive values.",
      score:
        "Correlation: x·y correlation coefficient. ANOVA F: one-way ANOVA F across legend groups. In-spec probability: chance a value falls between the lower and upper limits. Process capability: Cpk. These two need both limits.",
      value: "The empty cell value is used for cells with no data.",
      focus: "Highlights points (bars) that match the condition.",
      expression:
        "Use variables x, y with + - * / ^ and functions abs log ln sqrt exp round floor ceil min max pow. E.g. log(y), x * 2 + 1. Leave empty for the original value.",
    },
    left: "Left",
    center: "Center",
    right: "Right",
    top: "Top",
    bottom: "Bottom",
    circle: "Circle",
    square: "Square",
    triangle: "Triangle",
    diamond: "Diamond",
    cross: "Cross",
    xAxis: "X axis",
    yAxis: "Y axis",
    showAxis: "Show axis",
    showAxisTitle: "Show axis title",
    axisTitle: "Axis title",
    axisTitlePlaceholder: "Empty: column name",
    axisTitleColor: "Axis title color (empty: tick label color)",
    min: "Min",
    max: "Max",
    logAxis: "Log scale",
    showAxisLine: "Show axis line",
    axisLineWidth: "Axis line width",
    axisLineColor: "Axis line color",
    showGrid: "Show grid",
    gridWidth: "Grid width",
    gridColor: "Grid color",
    showTicks: "Show ticks",
    tickCount: "Tick count",
    tickLength: "Tick length",
    tickColor: "Tick color",
    showTickLabels: "Show tick labels",
    tickLabelAngle: "Tick label angle",
    tickLabelSize: "Tick label size",
    tickLabelColor: "Tick label color",
    decimals: "Decimals",
    dateFormat: "Date format",
    dateFormatPlaceholder: "e.g. %m/%d %H:%M · empty: auto",
    showTitle: "Show title",
    title: "Title",
    titlePlaceholder: "Empty: split combination",
    subtitle: "Subtitle",
    subtitleColor: "Subtitle color",
    fontSize: "Font size",
    bold: "Bold",
    fontColor: "Font color",
    align: "Align",
    summaryHeading: "Summary (point and category counts, right)",
    showSummary: "Show summary",
    summaryColor: "Summary color",
    showLegend: "Show legend",
    showBorder: "Show border",
    borderColor: "Border color",
    reverseOrder: "Reverse order",
    titleColor: "Title color",
    backColor: "Background color",
    gradient: "Gradient",
    border: "Border",
    margin: "Margins",
    useGradient: "Use gradient colors",
    startColor: "Start color",
    middleColor: "Middle color",
    endColor: "End color",
    steps: "Steps (0: number of legend values)",
    reverseColors: "Reverse colors",
    othersColor: "Other color ('Other' slice, rest when highlighting)",
    defaultShape: "Default shape",
    shapeStyle: "Style",
    fillAndBorder: "Fill + border",
    borderOnly: "Border only",
    fillOnly: "Fill only",
    shapeTransparency: "Transparency (0 = opaque)",
    borderWidth: "Border width",
    borderColorAuto: "Border color (empty: auto)",
    dimOpacity: "Unselected opacity",
    cornerRadius: "Bar corner radius",
    medianColor: "Median line color (boxplot)",
    pointSize: "Point size",
    auto: "Auto",
    fixedSize: "Fixed size",
    sizeMin: "Min",
    sizeMax: "Max",
    line: "Line",
    lineWidth: "Line width",
    showPointLabels: "Show point labels",
    position: "Position",
    angle: "Angle",
    prefix: "Prefix",
    suffix: "Suffix",
    box: "Box",
    showBox: "Show box",
    showScores: "Show scores",
    scoreKinds: "Scores",
    rscore: "Correlation (r)",
    fscore: "ANOVA F",
    zscore: "In-spec probability (z)",
    cpk: "Process capability (Cpk)",
    ucl: "Upper limit",
    lcl: "Lower limit",
    boxBackColor: "Box background color",
    boxBorderColor: "Box border color",
    boxBorderWidth: "Box border width",
    showPrediction: "Show forecast",
    method: "Method",
    sma: "Simple moving average",
    ses: "Simple exponential smoothing",
    des: "Double exponential smoothing",
    holtWinters: "Holt-Winters smoothing",
    period: "Forecast steps",
    showInterval: "Confidence interval",
    showDescription: "Show description",
    window: "Moving average window",
    alpha: "Level α (empty: auto)",
    beta: "Trend β (empty: auto)",
    gamma: "Seasonal γ (empty: auto)",
    trend: "Trend type",
    additive: "Additive",
    multiplicative: "Multiplicative",
    seasonLength: "Season length",
    seasonal: "Seasonal type",
    damped: "Damped",
    nullNumeric: "Empty cell value (empty: not drawn)",
    outlier: "Exclude outliers",
    outlierMethod: "Outlier method",
    sigma: "Normal (mean ± k·σ)",
    useFocus: "Enable highlight",
    target: "Target",
    xValue: "x value",
    yValue: "y value",
    condition: "Condition",
    value: "Value",
    color: "Color",
    shape: "Shape",
    size: "Size",
    legendSingleColor: "Single color for the rest",
    tooltipTitlePlaceholder: "Empty: no title",
    transparency: "Transparency",
    round: "Rounded corners",
    exprX: "X value",
    exprY: "Y value",
    exprXPlaceholder: "e.g. x * 2",
    exprYPlaceholder: "e.g. log(y)",
  },
});

type Text = (typeof messages)["ko"];

const isMethod =
  (...methods: ChartOptions["prediction"]["method"][]) =>
  (o: ChartOptions) =>
    methods.includes(o.prediction.method);

function axisFields(m: Text, axis: "x" | "y"): OptionField[] {
  const p = `axes.${axis}`;
  return [
    { kind: "boolean", path: `${p}.visible`, label: m.showAxis },
    { kind: "boolean", path: `${p}.title.visible`, label: m.showAxisTitle },
    {
      kind: "text",
      path: `${p}.title.text`,
      label: m.axisTitle,
      maxLength: 80,
      placeholder: m.axisTitlePlaceholder,
    },
    {
      kind: "color",
      path: `${p}.title.color`,
      label: m.axisTitleColor,
      optional: true,
    },
    {
      kind: "number",
      path: `${p}.min`,
      label: m.min,
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    {
      kind: "number",
      path: `${p}.max`,
      label: m.max,
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    { kind: "boolean", path: `${p}.log`, label: m.logAxis },
    { kind: "boolean", path: `${p}.line.visible`, label: m.showAxisLine },
    {
      kind: "number",
      path: `${p}.line.width`,
      label: m.axisLineWidth,
      min: 0,
      max: 10,
      step: 0.5,
    },
    { kind: "color", path: `${p}.line.color`, label: m.axisLineColor },
    { kind: "boolean", path: `${p}.grid.visible`, label: m.showGrid },
    {
      kind: "number",
      path: `${p}.grid.width`,
      label: m.gridWidth,
      min: 0,
      max: 10,
      step: 0.5,
    },
    { kind: "color", path: `${p}.grid.color`, label: m.gridColor },
    { kind: "boolean", path: `${p}.tick.visible`, label: m.showTicks },
    {
      kind: "number",
      path: `${p}.tick.count`,
      label: m.tickCount,
      min: 1,
      max: 20,
    },
    {
      kind: "number",
      path: `${p}.tick.length`,
      label: m.tickLength,
      min: 0,
      max: 20,
    },
    { kind: "color", path: `${p}.tick.color`, label: m.tickColor },
    { kind: "boolean", path: `${p}.label.visible`, label: m.showTickLabels },
    {
      kind: "number",
      path: `${p}.label.angle`,
      label: m.tickLabelAngle,
      min: -90,
      max: 90,
      step: 5,
    },
    {
      kind: "number",
      path: `${p}.label.fontSize`,
      label: m.tickLabelSize,
      min: 6,
      max: 40,
    },
    { kind: "color", path: `${p}.label.color`, label: m.tickLabelColor },
    {
      kind: "number",
      path: `${p}.decimals`,
      label: m.decimals,
      min: 0,
      max: 10,
      nullable: true,
    },
    {
      kind: "text",
      path: `${p}.dateFormat`,
      label: m.dateFormat,
      maxLength: 40,
      placeholder: m.dateFormatPlaceholder,
    },
  ];
}

/** 한 언어의 필드 표 */
function buildTables(m: Text) {
  const aligns: Choice[] = [
    { value: "left", label: m.left },
    { value: "center", label: m.center },
    { value: "right", label: m.right },
  ];
  const shapes: Choice[] = POINT_SHAPES.map((value) => ({
    value,
    label: m[value],
  }));

  const parts: Partial<Record<OptionSection, SectionPart[]>> = {
    axes: [
      { id: "x", label: m.xAxis, fields: axisFields(m, "x") },
      { id: "y", label: m.yAxis, fields: axisFields(m, "y") },
    ],
  };

  const fields: Record<OptionSection, OptionField[]> = {
    title: [
      { kind: "boolean", path: "title.visible", label: m.showTitle },
      {
        kind: "text",
        path: "title.text",
        label: m.title,
        maxLength: 80,
        placeholder: m.titlePlaceholder,
      },
      {
        kind: "text",
        path: "title.subtitle",
        label: m.subtitle,
        maxLength: 80,
      },
      { kind: "color", path: "title.subtitleColor", label: m.subtitleColor },
      {
        kind: "number",
        path: "title.fontSize",
        label: m.fontSize,
        min: 6,
        max: 40,
      },
      { kind: "boolean", path: "title.bold", label: m.bold },
      { kind: "color", path: "title.color", label: m.fontColor },
      {
        kind: "select",
        path: "title.align",
        label: m.align,
        options: aligns,
      },
      { kind: "heading", label: m.summaryHeading },
      { kind: "boolean", path: "title.summary.visible", label: m.showSummary },
      { kind: "color", path: "title.summary.color", label: m.summaryColor },
    ],
    axes: (parts.axes ?? []).flatMap((p) => p.fields),
    legend: [
      { kind: "boolean", path: "legend.visible", label: m.showLegend },
      { kind: "boolean", path: "legend.border", label: m.showBorder },
      { kind: "color", path: "legend.borderColor", label: m.borderColor },
      { kind: "boolean", path: "legend.reverse", label: m.reverseOrder },
      {
        kind: "number",
        path: "legend.fontSize",
        label: m.fontSize,
        min: 6,
        max: 40,
      },
      { kind: "color", path: "legend.fontColor", label: m.fontColor },
      { kind: "color", path: "legend.titleColor", label: m.titleColor },
    ],
    panel: [
      { kind: "color", path: "panel.backColor", label: m.backColor },
      { kind: "boolean", path: "panel.gradient", label: m.gradient },
      { kind: "boolean", path: "panel.border", label: m.border },
      { kind: "color", path: "panel.borderColor", label: m.borderColor },
      { kind: "heading", label: m.margin },
      ...(["top", "right", "bottom", "left"] as const).map(
        (side): OptionField => ({
          kind: "number",
          path: `panel.margin.${side}`,
          label: m[side],
          min: 0,
          max: 200,
        }),
      ),
    ],
    palette: [
      {
        kind: "boolean",
        path: "palette.gradient",
        label: m.useGradient,
      },
      { kind: "color", path: "palette.start", label: m.startColor },
      {
        kind: "color",
        path: "palette.middle",
        label: m.middleColor,
        optional: true,
      },
      { kind: "color", path: "palette.end", label: m.endColor },
      {
        kind: "number",
        path: "palette.steps",
        label: m.steps,
        min: 0,
        max: 64,
      },
      {
        kind: "boolean",
        path: "palette.reverse",
        label: m.reverseColors,
      },
      {
        kind: "color",
        path: "palette.othersColor",
        label: m.othersColor,
      },
    ],
    shape: [
      {
        kind: "select",
        path: "shape.type",
        label: m.defaultShape,
        options: shapes,
      },
      {
        kind: "select",
        path: "shape.style",
        label: m.shapeStyle,
        options: [
          { value: "both", label: m.fillAndBorder },
          { value: "border", label: m.borderOnly },
          { value: "brush", label: m.fillOnly },
        ],
      },
      {
        kind: "number",
        path: "shape.transparency",
        label: m.shapeTransparency,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        kind: "number",
        path: "shape.borderWidth",
        label: m.borderWidth,
        min: 0,
        max: 10,
        step: 0.5,
      },
      {
        kind: "color",
        path: "shape.borderColor",
        label: m.borderColorAuto,
        optional: true,
      },
      {
        kind: "number",
        path: "shape.dimOpacity",
        label: m.dimOpacity,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        kind: "number",
        path: "shape.cornerRadius",
        label: m.cornerRadius,
        min: 0,
        max: 20,
      },
      {
        kind: "color",
        path: "shape.medianColor",
        label: m.medianColor,
      },
    ],
    size: [
      { kind: "heading", label: m.pointSize },
      { kind: "boolean", path: "size.pointAuto", label: m.auto },
      {
        kind: "number",
        path: "size.pointFixed",
        label: m.fixedSize,
        min: 0.5,
        max: 40,
        step: 0.5,
        when: (o) => !o.size.pointAuto,
      },
      {
        kind: "number",
        path: "size.pointMin",
        label: m.sizeMin,
        min: 0.5,
        max: 40,
        step: 0.5,
      },
      {
        kind: "number",
        path: "size.pointMax",
        label: m.sizeMax,
        min: 0.5,
        max: 40,
        step: 0.5,
      },
      { kind: "heading", label: m.fontSize },
      { kind: "boolean", path: "size.fontAuto", label: m.auto },
      {
        kind: "number",
        path: "size.fontMin",
        label: m.sizeMin,
        min: 6,
        max: 40,
      },
      {
        kind: "number",
        path: "size.fontMax",
        label: m.sizeMax,
        min: 6,
        max: 40,
      },
      { kind: "heading", label: m.line },
      {
        kind: "number",
        path: "size.lineWidth",
        label: m.lineWidth,
        min: 0.5,
        max: 10,
        step: 0.5,
      },
    ],
    pointLabel: [
      {
        kind: "boolean",
        path: "pointLabel.visible",
        label: m.showPointLabels,
      },
      {
        kind: "select",
        path: "pointLabel.position",
        label: m.position,
        options: [
          { value: "top", label: m.top },
          { value: "center", label: m.center },
          { value: "bottom", label: m.bottom },
        ],
      },
      {
        kind: "number",
        path: "pointLabel.angle",
        label: m.angle,
        min: -90,
        max: 90,
        step: 5,
      },
      {
        kind: "number",
        path: "pointLabel.fontSize",
        label: m.fontSize,
        min: 6,
        max: 40,
      },
      { kind: "color", path: "pointLabel.color", label: m.fontColor },
      {
        kind: "text",
        path: "pointLabel.prefix",
        label: m.prefix,
        maxLength: 20,
      },
      {
        kind: "text",
        path: "pointLabel.suffix",
        label: m.suffix,
        maxLength: 20,
      },
      {
        kind: "number",
        path: "pointLabel.decimals",
        label: m.decimals,
        min: 0,
        max: 10,
        nullable: true,
      },
      { kind: "heading", label: m.box },
      { kind: "boolean", path: "pointLabel.box.visible", label: m.showBox },
      { kind: "color", path: "pointLabel.box.background", label: m.backColor },
      { kind: "color", path: "pointLabel.box.border", label: m.borderColor },
    ],
    score: [
      { kind: "boolean", path: "score.visible", label: m.showScores },
      {
        kind: "multi",
        path: "score.kinds",
        label: m.scoreKinds,
        options: [
          { value: "rscore", label: m.rscore },
          { value: "fscore", label: m.fscore },
          { value: "zscore", label: m.zscore },
          { value: "cpk", label: m.cpk },
        ],
      },
      {
        kind: "number",
        path: "score.ucl",
        label: m.ucl,
        min: -1e15,
        max: 1e15,
        nullable: true,
      },
      {
        kind: "number",
        path: "score.lcl",
        label: m.lcl,
        min: -1e15,
        max: 1e15,
        nullable: true,
      },
      {
        kind: "number",
        path: "score.fontSize",
        label: m.fontSize,
        min: 6,
        max: 40,
      },
      { kind: "color", path: "score.fontColor", label: m.fontColor },
      { kind: "color", path: "score.backColor", label: m.boxBackColor },
      { kind: "color", path: "score.borderColor", label: m.boxBorderColor },
      {
        kind: "number",
        path: "score.borderWidth",
        label: m.boxBorderWidth,
        min: 0,
        max: 10,
        step: 0.5,
      },
    ],
    prediction: [
      {
        kind: "boolean",
        path: "prediction.enabled",
        label: m.showPrediction,
      },
      {
        kind: "select",
        path: "prediction.method",
        label: m.method,
        options: [
          { value: "sma", label: m.sma },
          { value: "ses", label: m.ses },
          { value: "des", label: m.des },
          { value: "holtWinters", label: m.holtWinters },
        ],
      },
      {
        kind: "number",
        path: "prediction.period",
        label: m.period,
        min: 1,
        max: 500,
      },
      {
        kind: "boolean",
        path: "prediction.showInterval",
        label: m.showInterval,
      },
      {
        kind: "boolean",
        path: "prediction.description",
        label: m.showDescription,
      },
      {
        kind: "number",
        path: "prediction.window",
        label: m.window,
        min: 2,
        max: 500,
        when: isMethod("sma"),
      },
      {
        kind: "number",
        path: "prediction.alpha",
        label: m.alpha,
        min: 0,
        max: 1,
        step: 0.05,
        nullable: true,
        when: isMethod("ses", "des", "holtWinters"),
      },
      {
        kind: "number",
        path: "prediction.beta",
        label: m.beta,
        min: 0,
        max: 1,
        step: 0.05,
        nullable: true,
        when: isMethod("des", "holtWinters"),
      },
      {
        kind: "number",
        path: "prediction.gamma",
        label: m.gamma,
        min: 0,
        max: 1,
        step: 0.05,
        nullable: true,
        when: isMethod("holtWinters"),
      },
      {
        kind: "select",
        path: "prediction.trend",
        label: m.trend,
        options: [
          { value: "additive", label: m.additive },
          { value: "multiplicative", label: m.multiplicative },
        ],
        when: isMethod("des", "holtWinters"),
      },
      {
        kind: "number",
        path: "prediction.seasonLength",
        label: m.seasonLength,
        min: 2,
        max: 500,
        when: isMethod("holtWinters"),
      },
      {
        kind: "select",
        path: "prediction.seasonal",
        label: m.seasonal,
        options: [
          { value: "additive", label: m.additive },
          { value: "multiplicative", label: m.multiplicative },
        ],
        when: isMethod("holtWinters"),
      },
      {
        kind: "boolean",
        path: "prediction.damped",
        label: m.damped,
        when: isMethod("holtWinters"),
      },
    ],
    value: [
      {
        kind: "number",
        path: "value.nullNumeric",
        label: m.nullNumeric,
        min: -1e15,
        max: 1e15,
        nullable: true,
      },
      {
        kind: "boolean",
        path: "value.outlier",
        label: m.outlier,
      },
      {
        kind: "select",
        path: "value.outlierMethod",
        label: m.outlierMethod,
        options: [
          { value: "iqr", label: "IQR (Q1 − k·IQR .. Q3 + k·IQR)" },
          { value: "sigma", label: m.sigma },
        ],
      },
      {
        kind: "number",
        path: "value.outlierK",
        label: "k",
        min: 0,
        max: 10,
        step: 0.1,
      },
    ],
    focus: [
      { kind: "boolean", path: "focus.enabled", label: m.useFocus },
      {
        kind: "select",
        path: "focus.target",
        label: m.target,
        options: [
          { value: "x", label: m.xValue },
          { value: "y", label: m.yValue },
        ],
      },
      {
        kind: "select",
        path: "focus.operator",
        label: m.condition,
        options: FOCUS_OPERATORS.map((value) => ({ value, label: value })),
      },
      {
        kind: "number",
        path: "focus.value",
        label: m.value,
        min: -1e15,
        max: 1e15,
      },
      { kind: "color", path: "focus.color", label: m.color },
      {
        kind: "select",
        path: "focus.shape",
        label: m.shape,
        options: shapes,
      },
      {
        kind: "number",
        path: "focus.size",
        label: m.size,
        min: 0.5,
        max: 40,
        step: 0.5,
      },
      {
        kind: "boolean",
        path: "focus.legendSingleColor",
        label: m.legendSingleColor,
      },
    ],
    tooltip: [
      {
        kind: "text",
        path: "tooltip.title",
        label: m.title,
        maxLength: 80,
        placeholder: m.tooltipTitlePlaceholder,
      },
      {
        kind: "number",
        path: "tooltip.fontSize",
        label: m.fontSize,
        min: 6,
        max: 40,
      },
      { kind: "color", path: "tooltip.fontColor", label: m.fontColor },
      { kind: "color", path: "tooltip.background", label: m.backColor },
      {
        kind: "number",
        path: "tooltip.transparency",
        label: m.transparency,
        min: 0,
        max: 1,
        step: 0.05,
      },
      { kind: "boolean", path: "tooltip.round", label: m.round },
      { kind: "boolean", path: "tooltip.border", label: m.showBorder },
      { kind: "color", path: "tooltip.borderColor", label: m.borderColor },
      {
        kind: "text",
        path: "tooltip.prefix",
        label: m.prefix,
        maxLength: 20,
      },
      {
        kind: "text",
        path: "tooltip.suffix",
        label: m.suffix,
        maxLength: 20,
      },
      {
        kind: "number",
        path: "tooltip.decimals",
        label: m.decimals,
        min: 0,
        max: 10,
        nullable: true,
      },
    ],
    expression: [
      {
        kind: "text",
        path: "expression.x",
        label: m.exprX,
        maxLength: 120,
        placeholder: m.exprXPlaceholder,
      },
      {
        kind: "text",
        path: "expression.y",
        label: m.exprY,
        maxLength: 120,
        placeholder: m.exprYPlaceholder,
      },
    ],
  };

  return { labels: m.section, hints: m.hint, parts, fields };
}

const tables = new Map<Locale, ReturnType<typeof buildTables>>();

/** 지금 언어의 표. 언어마다 한 번 만들어 같은 객체를 돌려준다. */
function current() {
  const locale = getLocale();
  let value = tables.get(locale);
  if (!value) {
    value = buildTables(messages[locale]);
    tables.set(locale, value);
  }
  return value;
}

/** 구역 이름 (지금 언어). 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다. */
export function sectionLabels(): Readonly<Record<OptionSection, string>> {
  return current().labels;
}

/** 구역 아래에 붙는 도움말 */
export function sectionHints(): Readonly<
  Partial<Record<OptionSection, string>>
> {
  return current().hints;
}

/** 하위 항목으로 나눠 보이는 구역의 하위 항목 */
export function sectionParts(): Readonly<
  Partial<Record<OptionSection, SectionPart[]>>
> {
  return current().parts;
}

/** 구역마다의 필드 표 */
export function sectionFields(): Readonly<
  Record<OptionSection, OptionField[]>
> {
  return current().fields;
}

/** 구역(과 하위 항목)의 필드. 하위 항목이 있는 구역은 고른 항목의 필드만 보인다. */
export function fieldsOf(section: OptionSection, part?: string): OptionField[] {
  const parts = sectionParts()[section];
  if (!parts) return sectionFields()[section];
  return (parts.find((p) => p.id === part) ?? parts[0]).fields;
}

// ── 부분 값(patch) 다루기 ─────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 점 표기 경로의 값. 중간이 없으면 undefined */
export function getPath(source: unknown, path: string): unknown {
  let cur: unknown = source;
  for (const key of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** 경로에 값을 넣은 새 부분 값. 원본은 바꾸지 않는다. */
export function setPath(
  patch: ChartOptionsPatch | undefined,
  path: string,
  value: unknown,
): ChartOptionsPatch {
  const keys = path.split(".");
  const put = (node: unknown, i: number): Obj => {
    const base = isObj(node) ? node : {};
    const key = keys[i];
    return {
      ...base,
      [key]: i === keys.length - 1 ? value : put(base[key], i + 1),
    };
  };
  return put(patch, 0) as ChartOptionsPatch;
}

/** 구역 하나를 지운 부분 값. 남은 게 없으면 undefined (기본값·공통 속성을 따른다) */
export function removeSection(
  patch: ChartOptionsPatch | undefined,
  section: OptionSection,
): ChartOptionsPatch | undefined {
  if (!patch) return undefined;
  const { [section]: _removed, ...rest } = patch;
  return Object.keys(rest).length ? rest : undefined;
}

/** 구역 값을 하나라도 정했는지 */
export function hasSection(
  patch: ChartOptionsPatch | undefined,
  section: OptionSection,
) {
  return patch?.[section] !== undefined;
}

/** 구역의 모든 입력 필드 경로 (하위 항목까지) */
export function sectionPaths(section: OptionSection): string[] {
  return sectionFields()[section].flatMap((f) =>
    f.kind === "heading" ? [] : [f.path],
  );
}

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * 폼 값(화면에 보이는 전체 속성)에서 저장할 부분 값을 만든다.
 * - 원래 부분 값에 있던 필드는 그대로 정한 것으로 두고 지금 값으로 바꾼다.
 * - 원래 따르던 필드는 연 때의 값(opened)과 달라졌을 때만 정한다.
 * - 되돌린 구역(resets)은 원래 부분 값에서 지우고, 되돌린 값(base)과 다른 필드만 정한다.
 * 남은 게 없으면 undefined (기본값·공통 속성을 따른다).
 */
export function buildPatch({
  original,
  opened,
  base,
  values,
  resets,
}: {
  /** 열 때 저장돼 있던 부분 값 */
  original: ChartOptionsPatch | undefined;
  /** 열 때 화면에 보인 전체 값 */
  opened: ChartOptions;
  /** 따르기로 되돌렸을 때의 값 (전체 설정은 기본값, item은 공통 속성) */
  base: ChartOptions;
  /** 지금 폼 값 */
  values: ChartOptions;
  resets: readonly OptionSection[];
}): ChartOptionsPatch | undefined {
  let patch = original;
  for (const section of resets) patch = removeSection(patch, section);
  for (const section of Object.keys(sectionFields()) as OptionSection[]) {
    const reset = resets.includes(section);
    for (const path of sectionPaths(section)) {
      const value = getPath(values, path);
      const kept = !reset && getPath(original, path) !== undefined;
      const reference = reset ? base : opened;
      if (kept || !sameValue(value, getPath(reference, path)))
        patch = setPath(patch, path, value);
    }
  }
  return patch && Object.keys(patch).length ? patch : undefined;
}
