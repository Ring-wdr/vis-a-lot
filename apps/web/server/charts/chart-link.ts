// 칸 연결: 따를 칸 item의 지금 행 범위를 따르는 차트에 고정한다 (analytics).
// 요청 검증(404·409·422 사유)과 범위 키·요약 글자를 여기서 정하고, 조회·다시 그리기는 job-manager가 한다.

import type { ChartSpec } from "../api/types";
import {
  filtersRowsBySelection,
  isDistributionLine,
  POINT_CHARTS,
} from "./chart-fields";
import {
  type ChartLink,
  getChart,
  getItem,
  type LinkMode,
} from "./chart-store";
import { itemRowsScope } from "./item-scope";
import type { SpecColumn } from "./validate-spec";

/** PUT /charts/{chartId}/link와 POST /charts의 link */
export type LinkRequest = {
  source: { chartId: string; itemKey: string };
  mode: LinkMode;
  /** 데이터셋이 다를 때만: 연결 컬럼 (source = 따를 칸 쪽, target = 이 차트 쪽) */
  on?: { source: string; target: string };
};

export type LinkRejected = { status: 404 | 409 | 422; error: string };

/** 따를 칸이 될 수 있는 차트: 선택을 행으로 바꿀 수 있는 차트 (선택 필드) */
export function canFollow(spec: Pick<ChartSpec, "chartType" | "subType">) {
  return filtersRowsBySelection(spec);
}

/** 강조를 쓸 수 있는 차트: 행 하나를 점 하나로 그리는 scatter·line (분포 line 제외) */
export function canHighlight(spec: Pick<ChartSpec, "chartType" | "subType">) {
  return POINT_CHARTS.includes(spec.chartType) && !isDistributionLine(spec);
}

/** 이 차트 쪽 연결 컬럼이 스키마에 없으면 사유. 스키마를 아직 모르면(그리기 전) 확인하지 않는다. */
export function linkTargetError(
  link: Pick<ChartLink, "on">,
  columns: readonly SpecColumn[] | undefined,
) {
  if (!link.on || !columns) return undefined;
  if (columns.some((c) => c.name === link.on?.target)) return undefined;
  return `연결 컬럼 '${link.on.target}'이 이 칸의 데이터에 없습니다.`;
}

/**
 * 연결 요청 → 고정할 범위. 따를 칸 item에 선택이 없으면 link가 undefined다 (범위를 지운다).
 * 범위는 따를 칸 자신의 행 범위다: draw 필터 + 끈 legend 값 + 지운 영역 + 선택 영역 (그 칸이 따르는 범위는 빼고).
 */
export function resolveLink(
  target: { id?: string; spec: ChartSpec; columns?: readonly SpecColumn[] },
  request: LinkRequest,
): LinkRejected | { link: ChartLink | undefined } {
  if (request.source.chartId === target.id)
    return { status: 422, error: "자기 자신은 따를 수 없습니다." };
  const source = getChart(request.source.chartId);
  if (!source) return { status: 404, error: "unknown source chart" };
  if (!source.items)
    return { status: 409, error: "따를 칸이 아직 그려지지 않았습니다." };
  const item = getItem(source, request.source.itemKey);
  if (!item) return { status: 404, error: "unknown source item" };
  if (!canFollow(source.spec))
    return {
      status: 422,
      error: `${source.spec.chartType} 차트의 선택은 행으로 바꿀 수 없어 따를 수 없습니다.`,
    };
  if (request.mode === "highlight" && !canHighlight(target.spec))
    return {
      status: 422,
      error: "강조는 scatter·line(분포 제외) 차트에서만 쓸 수 있습니다.",
    };
  const same = source.spec.dataset === target.spec.dataset;
  // 같은 데이터셋이면 행 조건을 그대로 걸어 연결 컬럼을 쓰지 않는다.
  const on = same ? undefined : request.on;
  if (!same && !on)
    return {
      status: 422,
      error: "데이터셋이 달라 연결 컬럼을 골라야 합니다.",
    };
  if (on && !source.columns?.some((c) => c.name === on.source))
    return {
      status: 422,
      error: `연결 컬럼 '${on.source}'이 따를 칸의 데이터에 없습니다.`,
    };
  const targetError = on && linkTargetError({ on }, target.columns);
  if (targetError) return { status: 422, error: targetError };
  if (!item.selection) return { link: undefined };
  // bar·histogram의 선택은 그린 막대(metadata)로 판정하므로 그린 뒤에만 고정할 수 있다.
  if (!item.meta)
    return { status: 409, error: "따를 칸이 아직 그려지지 않았습니다." };
  const scope = itemRowsScope(source, item, { link: false });
  const key = JSON.stringify([scope, source.spec.dataset, on, request.mode]);
  return {
    link: {
      scope,
      sourceDataset: source.spec.dataset,
      ...(on ? { on: { source: on.source, target: on.target } } : {}),
      mode: request.mode,
      key,
    },
  };
}

/** PNG 제목 줄 요약 글자. 행 수를 모르면(조회 전) 없다. */
export function linkNote(link: ChartLink | undefined) {
  if (!link || link.rows === undefined) return undefined;
  const rows = `${link.rows.toLocaleString()}행`;
  return link.mode === "filter" ? `연결 ${rows}` : `연결 강조 ${rows}`;
}
