// 차트 설정을 데이터셋 스키마로 확인한다. 컬럼 이름과 타입이 데이터마다 다르므로
// 고정된 규칙 대신 "어떤 타입의 컬럼이어야 하는가"만 정해 두고 스키마에 맞춰 본다.

import type { ChartSpec } from "../api/types";
import type { LogicalType } from "../data/dataset-schema";
import { CHART_FIELDS } from "./chart-fields";

export type SpecColumn = {
  name: string;
  label: string;
  type: LogicalType;
  /** 적재 후 센 고유값 수. 모르면 null */
  distinct: number | null;
};

/** legend 팔레트는 8색이라 그보다 값이 많은 컬럼은 legend로 쓸 수 없다. */
export const LEGEND_MAX_VALUES = 8;

/** 문제가 있으면 사용자에게 그대로 보여줄 문장, 없으면 undefined */
export function specError(
  spec: ChartSpec,
  columns: readonly SpecColumn[],
): string | undefined {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const need = (name: string, role: string, ...types: LogicalType[]) => {
    const column = byName.get(name);
    if (!column) return `${role} 컬럼 '${name}'이 데이터에 없습니다.`;
    if (types.length > 0 && !types.includes(column.type)) {
      return `${role}에는 ${types.join(" / ")} 컬럼만 쓸 수 있습니다 ('${column.label}'은 ${column.type}).`;
    }
  };

  const fields = CHART_FIELDS[spec.chartType];
  const axis =
    need(spec.x, "x", ...fields.x) ??
    (fields.y ? need(spec.y, "y", ...fields.y) : undefined) ??
    (fields.z
      ? spec.z
        ? need(spec.z, "z", ...fields.z)
        : "z 컬럼을 골라 주세요."
      : undefined);
  if (axis) return axis;

  if (spec.legend !== null) {
    const error = need(spec.legend, "legend", "categorical");
    if (error) return error;
    const distinct = byName.get(spec.legend)?.distinct;
    if (
      distinct !== null &&
      distinct !== undefined &&
      distinct > LEGEND_MAX_VALUES
    ) {
      return `legend 컬럼은 값이 ${LEGEND_MAX_VALUES}개 이하여야 합니다 ('${spec.legend}'은 ${distinct}개).`;
    }
  }
  if (new Set(spec.splitBy).size !== spec.splitBy.length) {
    return "split by에 같은 컬럼이 두 번 있습니다.";
  }
  for (const name of spec.splitBy) {
    const error = need(name, "split by");
    if (error) return error;
  }
  for (const name of spec.tooltip) {
    const error = need(name, "tooltip");
    if (error) return error;
  }
  for (const f of spec.filters ?? []) {
    const error =
      f.kind === "range"
        ? need(f.column, "범위 필터", "numeric", "datetime")
        : need(f.column, "값 필터", "categorical");
    if (error) return error;
  }
}
