// 차트 설정을 데이터셋 스키마로 확인한다. 컬럼 이름과 타입이 데이터마다 다르므로
// 고정된 규칙 대신 "어떤 타입의 컬럼이어야 하는가"만 정해 두고 스키마에 맞춰 본다.

import type { ChartSpec } from "../api/types";
import type { LogicalType } from "../data/dataset-schema";
import {
  type LimitAxis,
  type LimitKind,
  type LimitLine,
  MAX_LIMIT_LINES,
} from "../render/options";
import { CHART_FIELDS, legendColumnOf } from "./chart-fields";
import { controlLimitSupport, supportsOption } from "./chart-options";

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
  if (fields.distinctXY && spec.x === spec.y) {
    return "x와 y에 서로 다른 컬럼을 골라 주세요.";
  }

  const legend = legendColumnOf(spec);
  if (legend !== null) {
    const error = need(legend, "legend", "categorical");
    if (error) return error;
    const distinct = byName.get(legend)?.distinct;
    if (
      distinct !== null &&
      distinct !== undefined &&
      distinct > LEGEND_MAX_VALUES
    ) {
      return `legend 컬럼은 값이 ${LEGEND_MAX_VALUES}개 이하여야 합니다 ('${legend}'은 ${distinct}개).`;
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
  return (
    controlLimitError(
      spec,
      spec.common.options?.controlLimit?.lines,
      columns,
    ) ??
    selectionFieldsError(spec, spec.common.options?.selection?.fields, columns)
  );
}

/**
 * 선택 필드 값 묶기의 컬럼(selection.fields) 검사. 개수·겹침은 요청 스키마가 본다. 데이터에 없는 컬럼이면 문장을 돌려준다.
 * 컬럼을 모르면(columns가 비면) 보지 않는다. 차트가 이 구역을 쓰지 않으면 저장할 때 버려지므로 보지 않는다.
 */
export function selectionFieldsError(
  spec: Pick<ChartSpec, "chartType">,
  fields: readonly string[] | undefined,
  columns: readonly SpecColumn[],
): string | undefined {
  if (!fields?.length || columns.length === 0) return;
  if (!supportsOption(spec.chartType, "selection")) return;
  const names = new Set(columns.map((c) => c.name));
  const missing = fields.find((name) => !names.has(name));
  if (missing !== undefined)
    return `선택 값 필드 '${missing}'이 데이터에 없습니다.`;
}

const AXIS_NAMES: Record<LimitAxis, string> = {
  left: "Left",
  bottom: "Bottom",
};
const KIND_NAMES: Record<LimitKind, string> = {
  reference: "기준선",
  column: "컬럼 선",
  band: "띠",
};

/**
 * 관리선 목록 검사. 공통 속성은 draw(specError)와 공통 속성 변경에서, item 속성은 PATCH …/props에서 부른다.
 * 그린 차트가 관리선을 쓰지 않으면(controlLimitSupport가 null) 선은 무시되므로 보지 않는다.
 * 문제가 있으면 사용자에게 그대로 보여줄 문장, 없으면 undefined
 */
export function controlLimitError(
  spec: Pick<ChartSpec, "chartType" | "subType" | "x">,
  lines: readonly LimitLine[] | undefined,
  columns: readonly SpecColumn[],
): string | undefined {
  if (!lines?.length) return;
  const xType = columns.find((c) => c.name === spec.x)?.type;
  const support = controlLimitSupport(spec, xType);
  if (!support) return;
  if (lines.length > MAX_LIMIT_LINES) {
    return `관리선은 ${MAX_LIMIT_LINES}개까지입니다.`;
  }
  const byName = new Map(columns.map((c) => [c.name, c]));
  const numeric = (name: string, line: string) => {
    const column = byName.get(name);
    if (!column)
      return `관리선 '${line}'의 컬럼 '${name}'이 데이터에 없습니다.`;
    if (column.type !== "numeric") {
      return `관리선에는 numeric 컬럼만 쓸 수 있습니다 ('${column.label}'은 ${column.type}).`;
    }
  };

  const names = new Set<string>();
  /** 축마다 usl·lsl은 하나씩: 영역 채우기와 Score 상·하한이 한 쌍을 기준으로 한다. */
  const specs = new Set<string>();
  for (const line of lines) {
    const name = line.name.trim();
    if (!name) return "관리선 이름을 적어 주세요.";
    if (names.has(name)) return `관리선 이름 '${name}'이 두 번 있습니다.`;
    names.add(name);

    if (!support[line.axis].includes(line.kind)) {
      return `관리선 '${name}': 이 차트의 ${AXIS_NAMES[line.axis]} 축에는 ${KIND_NAMES[line.kind]} 종류를 쓸 수 없습니다.`;
    }
    if (line.kind !== "reference" && line.multi) {
      if (!support.multi || line.axis !== "left") {
        return `관리선 '${name}': 구간별 값은 scatter·line의 Left 축에서만 쓸 수 있습니다.`;
      }
    }
    if (line.kind === "reference") {
      const time = line.axis === "bottom" && xType === "datetime";
      const ok = time
        ? typeof line.value === "string" &&
          !Number.isNaN(Date.parse(line.value))
        : typeof line.value === "number" && Number.isFinite(line.value);
      if (!ok) {
        return time
          ? `관리선 '${name}': 시계열 x축 기준선의 값은 시각이어야 합니다.`
          : `관리선 '${name}': 기준선의 값은 숫자여야 합니다.`;
      }
    } else {
      const error =
        numeric(line.column, name) ??
        (line.kind === "band" ? numeric(line.column2, name) : undefined);
      if (error) return error;
      if (line.kind === "band" && line.column === line.column2) {
        return `관리선 '${name}': 띠에는 서로 다른 두 컬럼을 골라 주세요.`;
      }
    }
    if (line.kind !== "band" && line.type !== "none") {
      const key = `${line.axis}:${line.type}`;
      if (specs.has(key)) {
        return `USL·LSL은 축마다 하나씩만 정할 수 있습니다 (${AXIS_NAMES[line.axis]} 축 ${line.type.toUpperCase()}가 두 번 있습니다).`;
      }
      specs.add(key);
    }
  }
}
