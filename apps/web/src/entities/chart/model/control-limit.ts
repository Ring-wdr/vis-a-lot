// 관리선 목록의 규칙. 서버 controlLimitError(server/charts/validate-spec.ts)와 같은 규칙으로
// 화면이 미리 막고(설정 창), 데이터셋·차트 종류·x를 바꿨을 때 맞지 않게 된 선을 정리한다(draft 바로잡기).
// 문구는 화면 쪽(features/chart-settings)이 사유 코드로 만든다.

import type { ChartSpec, ColumnInfo, ColumnType } from "@/shared/api/types";
import {
  type ChartOptionsPatch,
  controlLimitSupport,
  type LimitAxis,
  type LimitLine,
  type LimitSupport,
  MAX_LIMIT_LINES,
} from "./chart-options";

/** 선 하나가 맞지 않는 까닭. 서버 controlLimitError가 거절하는 것과 같다. */
export type LimitIssue =
  | { code: "name-empty" }
  | { code: "name-duplicate" }
  | { code: "kind-axis"; axis: LimitAxis }
  | { code: "multi" }
  | { code: "value-time" }
  | { code: "value-number" }
  | { code: "column-missing"; column: string }
  | { code: "column-type"; column: string; type: ColumnType }
  | { code: "band-same" }
  | { code: "spec-duplicate"; axis: LimitAxis; type: "usl" | "lsl" };

/** 선을 검사할 때 아는 것. columns가 없으면(스키마를 받기 전) 컬럼은 보지 않는다. */
export type LimitContext = {
  support: LimitSupport;
  columns: readonly ColumnInfo[] | undefined;
  /** x 컬럼 타입. 시계열이면 bottom 기준선 값은 ISO 시각이다. */
  xType: ColumnType | undefined;
};

/** 시계열 x의 bottom 기준선인지 (값이 ISO 시각) */
export function isTimeValue(
  line: Pick<LimitLine, "axis">,
  xType: ColumnType | undefined,
) {
  return line.axis === "bottom" && xType === "datetime";
}

function valueIssue(
  line: Extract<LimitLine, { kind: "reference" }>,
  xType: ColumnType | undefined,
): LimitIssue | undefined {
  if (isTimeValue(line, xType)) {
    return typeof line.value === "string" &&
      !Number.isNaN(Date.parse(line.value))
      ? undefined
      : { code: "value-time" };
  }
  return typeof line.value === "number" && Number.isFinite(line.value)
    ? undefined
    : { code: "value-number" };
}

function columnIssue(
  name: string,
  columns: readonly ColumnInfo[] | undefined,
): LimitIssue | undefined {
  if (!columns) return;
  const column = columns.find((c) => c.name === name);
  if (!column) return { code: "column-missing", column: name };
  if (column.type !== "numeric")
    return { code: "column-type", column: column.label, type: column.type };
}

/**
 * 선마다 맞지 않는 까닭 (없으면 undefined). 목록 순서대로 보고, 이름·USL·LSL 겹침은 뒤에 나온 선에 적는다.
 * 서버는 첫 사유 하나만 알려 주지만 화면은 선마다 보인다.
 */
export function limitIssues(
  lines: readonly LimitLine[],
  { support, columns, xType }: LimitContext,
): (LimitIssue | undefined)[] {
  const names = new Set<string>();
  const specs = new Set<string>();
  return lines.map((line) => {
    const name = line.name.trim();
    if (!name) return { code: "name-empty" };
    if (names.has(name)) return { code: "name-duplicate" };
    names.add(name);
    if (!support[line.axis].includes(line.kind))
      return { code: "kind-axis", axis: line.axis };
    if (
      line.kind !== "reference" &&
      line.multi &&
      (!support.multi || line.axis !== "left")
    )
      return { code: "multi" };
    if (line.kind === "reference") {
      const issue = valueIssue(line, xType);
      if (issue) return issue;
    } else {
      const issue =
        columnIssue(line.column, columns) ??
        (line.kind === "band" ? columnIssue(line.column2, columns) : undefined);
      if (issue) return issue;
      if (line.kind === "band" && line.column === line.column2)
        return { code: "band-same" };
    }
    if (line.kind !== "band" && line.type !== "none") {
      const key = `${line.axis}:${line.type}`;
      if (specs.has(key))
        return { code: "spec-duplicate", axis: line.axis, type: line.type };
      specs.add(key);
    }
    return undefined;
  });
}

/** 목록 전체가 맞는지. 선 수도 본다. */
export function limitLinesOk(
  lines: readonly LimitLine[],
  context: LimitContext,
) {
  return (
    lines.length <= MAX_LIMIT_LINES &&
    limitIssues(lines, context).every((issue) => issue === undefined)
  );
}

/** 스키마·차트가 바뀌어 생기는 까닭. 사용자가 고칠 것(이름, 띠의 같은 컬럼, USL 겹침)은 정리하지 않는다. */
const FIT_DROPS: ReadonlySet<LimitIssue["code"]> = new Set([
  "kind-axis",
  "value-time",
  "value-number",
  "column-missing",
  "column-type",
]);

/**
 * 차트 종류·하위 차트·x·데이터셋에 맞지 않게 된 선을 정리한다. 그 축에서 못 쓰는 종류, 없는·숫자형이 아닌 컬럼,
 * 축에 맞지 않는 기준선 값의 선은 지우고, 구간별을 못 쓰는 곳의 선은 구간별만 끈다. 바꿀 것이 없으면 그대로 돌려준다.
 * 관리선을 쓰지 않는 차트(support가 null)에서는 선을 보지도 그리지도 않으므로 그대로 둔다.
 */
export function fitLimitLines(
  lines: readonly LimitLine[],
  support: LimitSupport | null,
  columns: readonly ColumnInfo[],
  xType: ColumnType | undefined,
): readonly LimitLine[] {
  if (!support || lines.length === 0) return lines;
  let changed = false;
  const fitted: LimitLine[] = [];
  for (const line of lines) {
    let next = line;
    if (
      next.kind !== "reference" &&
      next.multi &&
      (!support.multi || next.axis !== "left")
    ) {
      next = { ...next, multi: false };
      changed = true;
    }
    // 이름·겹침과 상관없이 선 하나만 본다.
    const [issue] = limitIssues([next], { support, columns, xType });
    if (issue && FIT_DROPS.has(issue.code)) {
      changed = true;
      continue;
    }
    fitted.push(next);
  }
  return changed ? fitted : lines;
}

/**
 * draft의 공통 속성에 든 관리선을 차트·스키마에 맞게 정리한 patch. 바꿀 것이 없으면 undefined.
 * 데이터셋을 바꾸거나 스키마를 처음 받았을 때, 차트 종류·하위 차트·x를 바꿨을 때 쓴다 (fitSpecToSchema 다음).
 */
export function fitControlLimit(
  spec: Pick<ChartSpec, "chartType" | "subType" | "x" | "common">,
  columns: readonly ColumnInfo[],
): Pick<ChartSpec, "common"> | undefined {
  const options = spec.common.options as ChartOptionsPatch | undefined;
  const lines = options?.controlLimit?.lines as LimitLine[] | undefined;
  if (!lines?.length) return;
  const xType = columns.find((c) => c.name === spec.x)?.type;
  const fitted = fitLimitLines(
    lines,
    controlLimitSupport(spec, xType),
    columns,
    xType,
  );
  if (fitted === lines) return;
  return {
    common: {
      ...spec.common,
      options: {
        ...spec.common.options,
        controlLimit: {
          ...spec.common.options?.controlLimit,
          lines: [...fitted],
        },
      } as ChartSpec["common"]["options"],
    },
  };
}
