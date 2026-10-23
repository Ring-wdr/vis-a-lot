// 차트 속성(옵션) 편집 화면의 필드 표. 구역마다 필드 설명(라벨, 경로, 입력 종류)을 두고
// 한 컴포넌트(OptionSectionForm)가 그린다. 경로는 ChartOptions 기준 점 표기("title.text")다.

import {
  type ChartOptions,
  type ChartOptionsPatch,
  FOCUS_OPERATORS,
  type OptionSection,
  POINT_SHAPES,
} from "@/entities/chart/model/chart-options";

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

export const SECTION_LABELS: Record<OptionSection, string> = {
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
};

/** 구역 아래에 붙는 도움말 */
export const SECTION_HINTS: Partial<Record<OptionSection, string>> = {
  title: "글자 크기는 크기 › 글자 크기 자동을 끈 때만 씁니다.",
  axes: "글자 크기는 크기 › 글자 크기 자동을 끈 때만 씁니다. 로그 축은 양수 값 축에서만 적용됩니다.",
  score:
    "상관계수: x·y 상관계수, 분산분석 F: 범례 그룹 간 일원 분산분석 F, 규격 내 확률: 값이 하한~상한 안에 들 확률, 공정 능력: Cpk. 이 둘은 상한·하한이 있어야 계산합니다.",
  value: "빈 칸 값은 그 조합에 데이터가 없는 칸에 씁니다.",
  focus: "조건에 맞는 점(막대)을 강조합니다.",
  expression:
    "변수 x, y와 + - * / ^, 함수 abs log ln sqrt exp round floor ceil min max pow를 씁니다. 예: log(y), x * 2 + 1. 비우면 원래 값입니다.",
};

const ALIGNS: Choice[] = [
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
];

const SHAPES: Choice[] = POINT_SHAPES.map((value) => ({
  value,
  label: {
    circle: "원",
    square: "사각형",
    triangle: "삼각형",
    diamond: "마름모",
    cross: "십자",
  }[value],
}));

function axisFields(axis: "x" | "y"): OptionField[] {
  const p = `axes.${axis}`;
  return [
    { kind: "boolean", path: `${p}.visible`, label: "축 보이기" },
    { kind: "boolean", path: `${p}.title.visible`, label: "축 제목 보이기" },
    {
      kind: "text",
      path: `${p}.title.text`,
      label: "축 제목",
      maxLength: 80,
      placeholder: "비우면 컬럼 이름",
    },
    {
      kind: "number",
      path: `${p}.min`,
      label: "최솟값",
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    {
      kind: "number",
      path: `${p}.max`,
      label: "최댓값",
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    { kind: "boolean", path: `${p}.log`, label: "로그 축" },
    { kind: "boolean", path: `${p}.line.visible`, label: "축 선 보이기" },
    {
      kind: "number",
      path: `${p}.line.width`,
      label: "축 선 굵기",
      min: 0,
      max: 10,
      step: 0.5,
    },
    { kind: "color", path: `${p}.line.color`, label: "축 선 색" },
    { kind: "boolean", path: `${p}.grid.visible`, label: "그리드 보이기" },
    {
      kind: "number",
      path: `${p}.grid.width`,
      label: "그리드 굵기",
      min: 0,
      max: 10,
      step: 0.5,
    },
    { kind: "color", path: `${p}.grid.color`, label: "그리드 색" },
    { kind: "boolean", path: `${p}.tick.visible`, label: "눈금 보이기" },
    {
      kind: "number",
      path: `${p}.tick.count`,
      label: "눈금 개수",
      min: 1,
      max: 20,
    },
    {
      kind: "number",
      path: `${p}.tick.length`,
      label: "눈금 길이",
      min: 0,
      max: 20,
    },
    { kind: "color", path: `${p}.tick.color`, label: "눈금 색" },
    { kind: "boolean", path: `${p}.label.visible`, label: "눈금 글자 보이기" },
    {
      kind: "number",
      path: `${p}.label.angle`,
      label: "눈금 글자 각도",
      min: -90,
      max: 90,
      step: 5,
    },
    {
      kind: "number",
      path: `${p}.label.fontSize`,
      label: "눈금 글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "color", path: `${p}.label.color`, label: "눈금 글자 색" },
    {
      kind: "number",
      path: `${p}.decimals`,
      label: "소수 자리",
      min: 0,
      max: 10,
      nullable: true,
    },
    {
      kind: "text",
      path: `${p}.dateFormat`,
      label: "날짜 형식",
      maxLength: 40,
      placeholder: "예: %m/%d %H:%M · 비우면 자동",
    },
  ];
}

/** 필드가 많아 하위 메뉴로 나눠 보이는 구역. 메뉴에서 구역 아래에 하위 항목으로 붙는다. */
export type SectionPart = { id: string; label: string; fields: OptionField[] };

export const SECTION_PARTS: Partial<Record<OptionSection, SectionPart[]>> = {
  axes: [
    { id: "x", label: "X축", fields: axisFields("x") },
    { id: "y", label: "Y축", fields: axisFields("y") },
  ],
};

/** 구역(과 하위 항목)의 필드. 하위 항목이 있는 구역은 고른 항목의 필드만 보인다. */
export function fieldsOf(section: OptionSection, part?: string): OptionField[] {
  const parts = SECTION_PARTS[section];
  if (!parts) return SECTION_FIELDS[section];
  return (parts.find((p) => p.id === part) ?? parts[0]).fields;
}

const isMethod =
  (...methods: ChartOptions["prediction"]["method"][]) =>
  (o: ChartOptions) =>
    methods.includes(o.prediction.method);

export const SECTION_FIELDS: Record<OptionSection, OptionField[]> = {
  title: [
    { kind: "boolean", path: "title.visible", label: "제목 보이기" },
    {
      kind: "text",
      path: "title.text",
      label: "제목",
      maxLength: 80,
      placeholder: "비우면 split 조합 이름",
    },
    { kind: "text", path: "title.subtitle", label: "부제목", maxLength: 80 },
    {
      kind: "number",
      path: "title.fontSize",
      label: "글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "boolean", path: "title.bold", label: "굵게" },
    { kind: "color", path: "title.color", label: "글자 색" },
    {
      kind: "select",
      path: "title.align",
      label: "정렬",
      options: ALIGNS,
    },
  ],
  axes: [...axisFields("x"), ...axisFields("y")],
  legend: [
    { kind: "boolean", path: "legend.visible", label: "범례 보이기" },
    { kind: "boolean", path: "legend.border", label: "테두리 보이기" },
    { kind: "color", path: "legend.borderColor", label: "테두리 색" },
    { kind: "boolean", path: "legend.reverse", label: "순서 뒤집기" },
    {
      kind: "number",
      path: "legend.fontSize",
      label: "글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "color", path: "legend.fontColor", label: "글자 색" },
  ],
  panel: [
    { kind: "color", path: "panel.backColor", label: "배경 색" },
    { kind: "boolean", path: "panel.gradient", label: "그라데이션" },
    { kind: "boolean", path: "panel.border", label: "테두리" },
    { kind: "color", path: "panel.borderColor", label: "테두리 색" },
    { kind: "heading", label: "여백" },
    ...(["top", "right", "bottom", "left"] as const).map(
      (side): OptionField => ({
        kind: "number",
        path: `panel.margin.${side}`,
        label: { top: "위", right: "오른쪽", bottom: "아래", left: "왼쪽" }[
          side
        ],
        min: 0,
        max: 200,
      }),
    ),
  ],
  palette: [
    {
      kind: "boolean",
      path: "palette.gradient",
      label: "그라데이션 색 쓰기",
    },
    { kind: "color", path: "palette.start", label: "시작 색" },
    {
      kind: "color",
      path: "palette.middle",
      label: "중간 색",
      optional: true,
    },
    { kind: "color", path: "palette.end", label: "끝 색" },
    {
      kind: "number",
      path: "palette.steps",
      label: "단계 수 (0이면 범례 값 수)",
      min: 0,
      max: 64,
    },
    {
      kind: "boolean",
      path: "palette.reverse",
      label: "색 순서 뒤집기",
    },
  ],
  shape: [
    {
      kind: "select",
      path: "shape.type",
      label: "기본 모양",
      options: SHAPES,
    },
    {
      kind: "select",
      path: "shape.style",
      label: "적용",
      options: [
        { value: "both", label: "채우기 + 테두리" },
        { value: "border", label: "테두리만" },
        { value: "brush", label: "채우기만" },
      ],
    },
    {
      kind: "number",
      path: "shape.transparency",
      label: "투명도 (0 = 자동)",
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      kind: "number",
      path: "shape.borderWidth",
      label: "테두리 굵기",
      min: 0,
      max: 10,
      step: 0.5,
    },
  ],
  size: [
    { kind: "heading", label: "점 크기" },
    { kind: "boolean", path: "size.pointAuto", label: "자동" },
    {
      kind: "number",
      path: "size.pointFixed",
      label: "고정 크기",
      min: 0.5,
      max: 40,
      step: 0.5,
      when: (o) => !o.size.pointAuto,
    },
    {
      kind: "number",
      path: "size.pointMin",
      label: "최소",
      min: 0.5,
      max: 40,
      step: 0.5,
    },
    {
      kind: "number",
      path: "size.pointMax",
      label: "최대",
      min: 0.5,
      max: 40,
      step: 0.5,
    },
    { kind: "heading", label: "글자 크기" },
    { kind: "boolean", path: "size.fontAuto", label: "자동" },
    {
      kind: "number",
      path: "size.fontMin",
      label: "최소",
      min: 6,
      max: 40,
    },
    {
      kind: "number",
      path: "size.fontMax",
      label: "최대",
      min: 6,
      max: 40,
    },
    { kind: "heading", label: "선" },
    {
      kind: "number",
      path: "size.lineWidth",
      label: "선 굵기",
      min: 0.5,
      max: 10,
      step: 0.5,
    },
  ],
  pointLabel: [
    { kind: "boolean", path: "pointLabel.visible", label: "점 라벨 보이기" },
    {
      kind: "select",
      path: "pointLabel.position",
      label: "위치",
      options: [
        { value: "top", label: "위" },
        { value: "center", label: "가운데" },
        { value: "bottom", label: "아래" },
      ],
    },
    {
      kind: "number",
      path: "pointLabel.angle",
      label: "각도",
      min: -90,
      max: 90,
      step: 5,
    },
    {
      kind: "number",
      path: "pointLabel.fontSize",
      label: "글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "color", path: "pointLabel.color", label: "글자 색" },
    {
      kind: "text",
      path: "pointLabel.prefix",
      label: "앞 글자",
      maxLength: 20,
    },
    {
      kind: "text",
      path: "pointLabel.suffix",
      label: "뒤 글자",
      maxLength: 20,
    },
    {
      kind: "number",
      path: "pointLabel.decimals",
      label: "소수 자리",
      min: 0,
      max: 10,
      nullable: true,
    },
    { kind: "heading", label: "상자" },
    { kind: "boolean", path: "pointLabel.box.visible", label: "상자 보이기" },
    { kind: "color", path: "pointLabel.box.background", label: "배경 색" },
    { kind: "color", path: "pointLabel.box.border", label: "테두리 색" },
  ],
  score: [
    { kind: "boolean", path: "score.visible", label: "점수 보이기" },
    {
      kind: "multi",
      path: "score.kinds",
      label: "점수 목록",
      options: [
        { value: "rscore", label: "상관계수 (r)" },
        { value: "fscore", label: "분산분석 F" },
        { value: "zscore", label: "규격 내 확률 (z)" },
        { value: "cpk", label: "공정 능력 (Cpk)" },
      ],
    },
    {
      kind: "number",
      path: "score.ucl",
      label: "상한",
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    {
      kind: "number",
      path: "score.lcl",
      label: "하한",
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    {
      kind: "number",
      path: "score.fontSize",
      label: "글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "color", path: "score.fontColor", label: "글자 색" },
    { kind: "color", path: "score.backColor", label: "상자 배경 색" },
    { kind: "color", path: "score.borderColor", label: "상자 테두리 색" },
    {
      kind: "number",
      path: "score.borderWidth",
      label: "상자 테두리 굵기",
      min: 0,
      max: 10,
      step: 0.5,
    },
  ],
  prediction: [
    {
      kind: "boolean",
      path: "prediction.enabled",
      label: "예측 보이기",
    },
    {
      kind: "select",
      path: "prediction.method",
      label: "방법",
      options: [
        { value: "sma", label: "단순 이동 평균" },
        { value: "ses", label: "단순 지수 평활" },
        { value: "des", label: "이중 지수 평활" },
        { value: "holtWinters", label: "홀트-윈터스 지수 평활" },
      ],
    },
    {
      kind: "number",
      path: "prediction.period",
      label: "예측 개수",
      min: 1,
      max: 500,
    },
    {
      kind: "boolean",
      path: "prediction.showInterval",
      label: "신뢰 구간",
    },
    {
      kind: "boolean",
      path: "prediction.description",
      label: "설명 보이기",
    },
    {
      kind: "number",
      path: "prediction.window",
      label: "이동 평균 길이",
      min: 2,
      max: 500,
      when: isMethod("sma"),
    },
    {
      kind: "number",
      path: "prediction.alpha",
      label: "수준 계수 α (비우면 자동)",
      min: 0,
      max: 1,
      step: 0.05,
      nullable: true,
      when: isMethod("ses", "des", "holtWinters"),
    },
    {
      kind: "number",
      path: "prediction.beta",
      label: "추세 계수 β (비우면 자동)",
      min: 0,
      max: 1,
      step: 0.05,
      nullable: true,
      when: isMethod("des", "holtWinters"),
    },
    {
      kind: "number",
      path: "prediction.gamma",
      label: "계절 계수 γ (비우면 자동)",
      min: 0,
      max: 1,
      step: 0.05,
      nullable: true,
      when: isMethod("holtWinters"),
    },
    {
      kind: "select",
      path: "prediction.trend",
      label: "추세 방식",
      options: [
        { value: "additive", label: "덧셈" },
        { value: "multiplicative", label: "곱셈" },
      ],
      when: isMethod("des", "holtWinters"),
    },
    {
      kind: "number",
      path: "prediction.seasonLength",
      label: "계절 길이",
      min: 2,
      max: 500,
      when: isMethod("holtWinters"),
    },
    {
      kind: "select",
      path: "prediction.seasonal",
      label: "계절 방식",
      options: [
        { value: "additive", label: "덧셈" },
        { value: "multiplicative", label: "곱셈" },
      ],
      when: isMethod("holtWinters"),
    },
    {
      kind: "boolean",
      path: "prediction.damped",
      label: "감쇠",
      when: isMethod("holtWinters"),
    },
  ],
  value: [
    {
      kind: "number",
      path: "value.nullNumeric",
      label: "빈 칸 값 (비우면 그리지 않음)",
      min: -1e15,
      max: 1e15,
      nullable: true,
    },
    {
      kind: "boolean",
      path: "value.outlier",
      label: "이상치 빼기",
    },
    {
      kind: "select",
      path: "value.outlierMethod",
      label: "이상치 방식",
      options: [
        { value: "iqr", label: "IQR (Q1 − k·IQR .. Q3 + k·IQR)" },
        { value: "sigma", label: "정규분포 (평균 ± k·σ)" },
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
    { kind: "boolean", path: "focus.enabled", label: "강조 쓰기" },
    {
      kind: "select",
      path: "focus.target",
      label: "대상",
      options: [
        { value: "x", label: "x 값" },
        { value: "y", label: "y 값" },
      ],
    },
    {
      kind: "select",
      path: "focus.operator",
      label: "조건",
      options: FOCUS_OPERATORS.map((value) => ({ value, label: value })),
    },
    {
      kind: "number",
      path: "focus.value",
      label: "값",
      min: -1e15,
      max: 1e15,
    },
    { kind: "color", path: "focus.color", label: "색" },
    {
      kind: "select",
      path: "focus.shape",
      label: "모양",
      options: SHAPES,
    },
    {
      kind: "number",
      path: "focus.size",
      label: "크기",
      min: 0.5,
      max: 40,
      step: 0.5,
    },
    {
      kind: "boolean",
      path: "focus.legendSingleColor",
      label: "나머지는 한 가지 색",
    },
  ],
  tooltip: [
    {
      kind: "text",
      path: "tooltip.title",
      label: "제목",
      maxLength: 80,
      placeholder: "비우면 제목 없음",
    },
    {
      kind: "number",
      path: "tooltip.fontSize",
      label: "글자 크기",
      min: 6,
      max: 40,
    },
    { kind: "color", path: "tooltip.fontColor", label: "글자 색" },
    { kind: "color", path: "tooltip.background", label: "배경 색" },
    {
      kind: "number",
      path: "tooltip.transparency",
      label: "투명도",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { kind: "boolean", path: "tooltip.round", label: "둥근 모서리" },
    { kind: "boolean", path: "tooltip.border", label: "테두리 보이기" },
    { kind: "color", path: "tooltip.borderColor", label: "테두리 색" },
    {
      kind: "text",
      path: "tooltip.prefix",
      label: "앞 글자",
      maxLength: 20,
    },
    {
      kind: "text",
      path: "tooltip.suffix",
      label: "뒤 글자",
      maxLength: 20,
    },
    {
      kind: "number",
      path: "tooltip.decimals",
      label: "소수 자리",
      min: 0,
      max: 10,
      nullable: true,
    },
  ],
  expression: [
    {
      kind: "text",
      path: "expression.x",
      label: "X 값",
      maxLength: 120,
      placeholder: "예: x * 2",
    },
    {
      kind: "text",
      path: "expression.y",
      label: "Y 값",
      maxLength: 120,
      placeholder: "예: log(y)",
    },
  ],
};

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
