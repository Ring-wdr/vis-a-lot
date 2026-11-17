// 칸 연결 규칙 (analytics). 따를 칸이 될 수 있는 차트, 강조를 쓸 수 있는 차트와 기본 방식, 연결 컬럼 기본값,
// 데이터셋·차트 종류가 바뀐 뒤 연결을 다시 맞추는 일을 순수 함수로 둔다. 서버의 같은 규칙은
// server/charts/chart-link.ts(canFollow·canHighlight·resolveLink)다.

import type {
  AnalyticsPanelLink,
  ChartSpec,
  ColumnInfo,
  LinkColumns,
  LinkMode,
} from "@/shared/api/types";
import { isDistributionLine, supports } from "@/shared/config/chart-kinds";

/** 칸 차트(split 없음)의 item 키. 서버 NO_SPLIT_KEY와 같다. */
export const PANEL_ITEM_KEY = "all";

type KindSpec = Pick<ChartSpec, "chartType" | "subType">;

/** 따를 칸이 될 수 있는 차트: 선택을 행으로 바꿀 수 있는 차트(선택 필드) */
export function canFollow(spec: KindSpec) {
  return supports(spec, "selectField");
}

/** 강조를 쓸 수 있는 차트: 행 하나를 점 하나로 그리는 scatter·line (분포 line 제외) */
export function canHighlight(spec: KindSpec) {
  return (
    (spec.chartType === "scatter" || spec.chartType === "line") &&
    !isDistributionLine(spec)
  );
}

/** 새 연결의 방식: 강조를 쓸 수 있으면 강조, 아니면 거르기 */
export function defaultLinkMode(spec: KindSpec): LinkMode {
  return canHighlight(spec) ? "highlight" : "filter";
}

/** 이 차트에 보낼 방식. 강조를 쓸 수 없는 차트면 거르기다. */
export function effectiveLinkMode(mode: LinkMode, spec: KindSpec): LinkMode {
  return mode === "highlight" && !canHighlight(spec) ? "filter" : mode;
}

/**
 * 연결 컬럼 기본값: 두 데이터셋에 이름과 타입이 같은 범주 컬럼 중 따를 칸 스키마 순서로 첫 컬럼.
 * 없으면 undefined (고를 때까지 연결이 걸리지 않는다).
 */
export function defaultLinkColumns(
  source: readonly ColumnInfo[],
  target: readonly ColumnInfo[],
): LinkColumns | undefined {
  const match = source.find(
    (c) =>
      c.type === "categorical" &&
      target.some((t) => t.name === c.name && t.type === c.type),
  );
  return match ? { source: match.name, target: match.name } : undefined;
}

/** 연결 컬럼이 두 스키마에 있는지. 스키마를 아직 모르는 쪽은 확인하지 않는다. */
function columnsFit(
  on: LinkColumns,
  source: readonly ColumnInfo[] | undefined,
  target: readonly ColumnInfo[] | undefined,
) {
  return (
    (!source || source.some((c) => c.name === on.source)) &&
    (!target || target.some((c) => c.name === on.target))
  );
}

const sameColumns = (a?: LinkColumns, b?: LinkColumns) =>
  a?.source === b?.source && a?.target === b?.target;

/**
 * 데이터셋·차트 종류가 바뀐 뒤 연결을 다시 맞춘다. 바뀐 것이 없으면 같은 참조를 돌려준다.
 * - 방식: 이 칸 차트가 강조를 쓸 수 없게 되면 거르기로 바꾼다.
 * - 연결 컬럼: 같은 데이터셋이면 뺀다. 다르면 데이터셋이 바뀌었거나(reset), 없거나, 스키마에 없을 때 기본값으로 정한다.
 *   기본값을 정하려면 두 스키마가 다 있어야 한다. 없으면 그대로 둔다.
 */
export function fitLink(
  link: AnalyticsPanelLink,
  ctx: {
    /** 따를 칸 데이터셋 (그린 차트가 있으면 그린 설정, 없으면 고치는 설정) */
    sourceDataset: string;
    /** 이 칸 (고치는 설정) */
    target: Pick<ChartSpec, "dataset" | "chartType" | "subType">;
    sourceColumns: readonly ColumnInfo[] | undefined;
    targetColumns: readonly ColumnInfo[] | undefined;
    /** 어느 쪽이든 데이터셋이 바뀌어 연결 컬럼을 기본값으로 다시 정한다. */
    reset?: boolean;
  },
): AnalyticsPanelLink {
  const mode = effectiveLinkMode(link.mode, ctx.target);
  let on = link.on;
  if (ctx.sourceDataset === ctx.target.dataset) on = undefined;
  else if (
    ctx.reset ||
    !on ||
    !columnsFit(on, ctx.sourceColumns, ctx.targetColumns)
  ) {
    if (ctx.sourceColumns && ctx.targetColumns)
      on = defaultLinkColumns(ctx.sourceColumns, ctx.targetColumns);
  }
  if (mode === link.mode && sameColumns(on, link.on)) return link;
  return { follow: link.follow, mode, ...(on ? { on } : {}) };
}
