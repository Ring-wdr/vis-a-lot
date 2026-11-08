// 차트 종류별 컬럼 역할과 상단 도구 줄에서 쓸 수 있는 기능. 새 차트는 여기에 한 줄씩 더한다.
// 서버의 같은 표(server/charts/chart-fields.ts)와 컬럼 타입이 맞아야 한다.

import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import type {
  ChartSpec,
  ChartSubType,
  ChartType,
  ColumnType,
} from "@/shared/api/types";
import { linguiFor } from "@/shared/lib/i18n";
import "@/shared/config/messages";

export type ChartFields = {
  x: readonly ColumnType[];
  /** null이면 y를 쓰지 않아 고르지 않는다 */
  y: readonly ColumnType[] | null;
  /** 세 번째 값 컬럼. 없으면 고르지 않는다 */
  z?: readonly ColumnType[];
  /** 통계 함수(spec.agg)를 고르는지 */
  agg: boolean;
  /** false면 legend 컬럼을 고르지 않는다. 차트가 정한 값(예: sankey 출발 노드)으로 legend를 그린다. */
  legend?: false;
};

type FieldRole = "x" | "y" | "z";

const FIELD_LABELS: Partial<
  Record<ChartType, Partial<Record<FieldRole, MessageDescriptor>>>
> = {
  sankey: { x: msg`출발 (x)`, y: msg`도착 (y)`, z: msg`흐름 값 (z)` },
  gantt: { y: msg`y (작업 행)` },
};

/** 왼쪽 패널의 컬럼 라벨(지금 언어). 차트가 따로 정하지 않았으면 x, y, z */
export function fieldLabel(chartType: ChartType, role: FieldRole) {
  const label = FIELD_LABELS[chartType]?.[role];
  return label ? linguiFor()._(label) : role;
}

export const CHART_FIELDS: Record<ChartType, ChartFields> = {
  scatter: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
  bar: { x: ["categorical"], y: ["numeric"], agg: true },
  boxplot: { x: ["categorical"], y: ["numeric"], agg: false },
  line: { x: ["datetime", "numeric"], y: ["numeric"], agg: false },
  sankey: {
    x: ["categorical"],
    y: ["categorical"],
    z: ["numeric"],
    agg: true,
    legend: false,
  },
  heatmap: {
    x: ["categorical", "datetime"],
    y: ["categorical"],
    z: ["numeric"],
    agg: true,
    legend: false,
  },
  treemap: { x: ["categorical"], y: ["numeric"], agg: true },
  candle: { x: ["datetime"], y: ["numeric"], agg: false, legend: false },
  gantt: {
    x: ["datetime"],
    y: ["categorical"],
    agg: false,
  },
  pie: { x: ["categorical"], y: ["numeric"], agg: true, legend: false },
  radar: { x: ["categorical"], y: ["numeric"], agg: true },
  histogram: { x: ["numeric"], y: null, agg: false },
  // 막대 종류(증가·감소·합계)가 곧 legend다.
  waterfall: {
    x: ["categorical"],
    y: ["numeric"],
    agg: true,
    legend: false,
  },
  // 단계(값 큰 순으로 줄 세운 범주)가 곧 legend다.
  funnel: {
    x: ["categorical"],
    y: ["numeric"],
    agg: true,
    legend: false,
  },
};

/**
 * 상단 도구 줄 기능. 모드(이동·확대·선택·삭제·페인트)와 체크박스 표시를 차트 종류마다 켜고 끈다.
 * 선택 필드는 데이터 다운로드·데이터 테이블이 선택 영역 안의 행만 담는지다(서버 SELECTION_ROW_CHARTS와 맞춘다).
 * 두 도구 자체는 모든 차트에서 쓴다.
 */
export const CHART_FEATURES = [
  "pan",
  "zoom",
  "select",
  "selectField",
  "delete",
  "paint",
  "checkbox",
] as const;
export type ChartFeature = (typeof CHART_FEATURES)[number];

const ALL = CHART_FEATURES;
const NO_DELETE = CHART_FEATURES.filter((f) => f !== "delete");

export const CHART_SUPPORT: Record<ChartType, readonly ChartFeature[]> = {
  scatter: ALL,
  bar: NO_DELETE,
  boxplot: NO_DELETE,
  line: ALL,
  sankey: ["select", "checkbox"],
  heatmap: ["pan", "zoom", "select", "paint"],
  treemap: ["pan", "zoom", "select", "checkbox"],
  candle: ["pan", "zoom", "select", "paint", "checkbox"],
  gantt: ["pan", "zoom", "select", "paint", "checkbox"],
  // 이동·확대가 없는 고정 좌표 차트: 선택(조각 중심점)과 체크박스(조각 숨기기)만
  pie: ["select", "checkbox"],
  // 고정 좌표 차트: 선택(꼭짓점)과 체크박스(계열 숨기기)만
  radar: ["select", "checkbox"],
  histogram: NO_DELETE,
  waterfall: NO_DELETE,
  // 고정 좌표 차트: 선택(막대 가운데)과 체크박스(단계 숨기기)만
  funnel: ["select", "checkbox"],
};

/** 차트별 하위 차트. 첫 값이 기본이다. 서버 SUB_TYPES(server/charts/chart-fields.ts)와 맞춘다. */
export const SUB_TYPES: Partial<Record<ChartType, readonly ChartSubType[]>> = {
  line: ["none", "ecdf", "ncdf", "probability"],
  bar: ["side", "stack", "stack100"],
  boxplot: ["none", "dot"],
  pie: ["none", "doughnut", "pie3d", "sunburst"],
};

const SUB_TYPE_NAMES: Record<Exclude<ChartSubType, "none">, string> = {
  ecdf: "ECDF",
  ncdf: "NCDF",
  probability: "Probability",
  side: "Side",
  stack: "Stack",
  stack100: "Stack 100",
  dot: "Dot",
  doughnut: "Doughnut",
  pie3d: "Pie 3D",
  sunburst: "Sunburst",
};

/** 하위 차트 이름. 기본(none)만 언어마다 다르다. 그리는 컴포넌트는 useLocale로 구독한다. */
export function subTypeLabel(sub: ChartSubType) {
  return sub === "none"
    ? t({ message: "기본", context: "chart sub type" })
    : SUB_TYPE_NAMES[sub];
}

type SubTypeSpec = Pick<ChartSpec, "chartType" | "subType">;

/** 그릴 하위 차트. 없거나 그 차트에 없는 값이면 기본값, 하위 차트가 없는 차트면 undefined */
export function subTypeOf(spec: SubTypeSpec): ChartSubType | undefined {
  const list = SUB_TYPES[spec.chartType];
  if (!list) return undefined;
  return spec.subType && list.includes(spec.subType) ? spec.subType : list[0];
}

/** line의 분포 하위 차트(ECDF·정규 CDF·정규 확률). y 컬럼 값의 분포라 x 컬럼을 쓰지 않는다. */
export function isDistributionLine(spec: SubTypeSpec) {
  const sub = subTypeOf(spec);
  return (
    spec.chartType === "line" &&
    (sub === "ecdf" || sub === "ncdf" || sub === "probability")
  );
}

/** legend 컬럼을 고르는지. pie sunburst는 legend 컬럼을 바깥 고리로 쓴다. */
export function usesLegendColumn(spec: SubTypeSpec) {
  if (spec.chartType === "pie" && subTypeOf(spec) === "sunburst") return true;
  return CHART_FIELDS[spec.chartType].legend !== false;
}

/** 그릴 때 쓰는 legend 컬럼. legend 컬럼을 쓰지 않는 차트면 고른 값이 남아 있어도 null */
export function legendColumnOf(
  spec: Pick<ChartSpec, "chartType" | "legend" | "subType">,
) {
  return usesLegendColumn(spec) ? spec.legend : null;
}

/** PNG에 legend를 그리는지. legend 컬럼을 쓰지 않는 차트는 차트가 정한 값으로 늘 그린다. */
export function drawsLegend(spec: Pick<ChartSpec, "chartType" | "legend">) {
  return CHART_FIELDS[spec.chartType].legend === false || spec.legend !== null;
}

/**
 * 그린 차트가 기능을 쓸 수 있는지. 분포 line은 점 좌표가 컬럼 값이 아니라 지우기와 선택 필드를 쓰지 않는다
 * (서버 canDelete·filtersRowsBySelection과 맞춘다).
 */
export function supports(spec: SubTypeSpec | undefined, feature: ChartFeature) {
  if (!spec || !CHART_SUPPORT[spec.chartType].includes(feature)) return false;
  if (
    (feature === "delete" || feature === "selectField") &&
    isDistributionLine(spec)
  )
    return false;
  return true;
}
