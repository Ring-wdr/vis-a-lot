"use client";

// 관리선 구역의 선 목록 편집. 선 목록은 배열이라 필드 표(option-fields.ts)로 그리지 않고
// 전용 컴포넌트(ControlLimitSettings)가 options.controlLimit.lines를 useFieldArray로 다룬다.
// 저장(buildPatch)·되돌리기는 다른 칸처럼 경로 하나(controlLimit.lines)로 통째로 다룬다.

import { t } from "@lingui/core/macro";
import { useFormContext, useWatch } from "react-hook-form";
import {
  controlLimitSupport,
  LIMIT_AXES,
  LIMIT_KINDS,
  type LimitAxis,
  type LimitKind,
  type LimitLine,
  type LimitSupport,
  MAX_LIMIT_LINES,
} from "@/entities/chart/model/chart-options";
import {
  isTimeValue,
  type LimitIssue,
  limitIssues,
} from "@/entities/chart/model/control-limit";
import type { ChartSpec, ColumnInfo, ColumnType } from "@/shared/api/types";
import { defaultLegendColor } from "@/shared/lib/palette";
import "../config/messages";
import type { OptionsFormValues } from "./options-form";

/**
 * 선 목록 편집이 아는 차트·데이터. 여는 쪽(전체 설정은 draft, item 속성은 그린 spec)이 만들어 넘긴다.
 * support가 null이면 이 차트는 관리선을 쓰지 않는다 (구역을 끈다).
 */
export type LimitSource = {
  support: LimitSupport | null;
  /** 데이터셋의 컬럼. 받기 전이면 undefined라 컬럼은 검사하지 않는다. */
  columns: readonly ColumnInfo[] | undefined;
  /** x 컬럼 타입. 시계열이면 Bottom 기준선 값은 시각이다. */
  xType: ColumnType | undefined;
  /** 새 컬럼 선이 처음 고를 컬럼 (y가 숫자면 y) */
  preferred: string | undefined;
};

/** spec과 그 데이터셋 컬럼으로 만든 선 목록 편집 정보 */
export function limitSourceOf(
  spec: Pick<ChartSpec, "chartType" | "subType" | "x" | "y">,
  columns: readonly ColumnInfo[] | undefined,
): LimitSource {
  const xType = columns?.find((c) => c.name === spec.x)?.type;
  return {
    support: controlLimitSupport(spec, xType),
    columns,
    xType,
    preferred: spec.y || undefined,
  };
}

/** 관리선 구역을 쓰는 차트인지 (분포 line처럼 구역을 끈 하위 차트는 아니다) */
export function usesControlLimit(
  spec: Pick<ChartSpec, "chartType" | "subType">,
) {
  return controlLimitSupport(spec) !== null;
}

/** 컬럼 select에 보일 숫자 컬럼 */
export function numericColumns(source: LimitSource) {
  return (source.columns ?? []).filter((c) => c.type === "numeric");
}

/** 이 차트에서 더할 수 있는 선 종류 (어느 축에서든 쓸 수 있는 것) */
export function addableKinds(support: LimitSupport): LimitKind[] {
  return LIMIT_KINDS.filter(
    (kind) => support.left.includes(kind) || support.bottom.includes(kind),
  );
}

/** 이 종류의 선을 놓을 수 있는 축 */
export function axesFor(support: LimitSupport, kind: LimitKind): LimitAxis[] {
  return LIMIT_AXES.filter((axis) => support[axis].includes(kind));
}

/** 목록에 없는 이름. base 뒤에 1부터 번호를 붙인다. */
export function uniqueLimitName(base: string, lines: readonly LimitLine[]) {
  const taken = new Set(lines.map((l) => l.name.trim()));
  for (let n = 1; ; n++) {
    const name = `${base} ${n}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * 새 선. 축은 그 종류를 쓸 수 있는 첫 축(Left 먼저), 컬럼은 y(숫자면)나 첫 숫자 컬럼, 띠의 두 번째 컬럼은 그와 다른 숫자 컬럼이다.
 * 색은 목록 순서대로 팔레트 색을 준다.
 */
export function newLimitLine(
  kind: LimitKind,
  source: LimitSource & { support: LimitSupport },
  lines: readonly LimitLine[],
  name: string,
): LimitLine {
  const axis = axesFor(source.support, kind)[0] ?? "left";
  const base = {
    name,
    axis,
    color: defaultLegendColor(lines.length),
    width: 1.5,
    style: "dash" as const,
  };
  if (kind === "reference")
    return {
      ...base,
      kind,
      value: isTimeValue({ axis }, source.xType) ? "" : 0,
      type: "none",
    };
  const numeric = numericColumns(source).map((c) => c.name);
  const first = numeric.find((c) => c === source.preferred) ?? numeric[0] ?? "";
  if (kind === "column")
    return {
      ...base,
      kind,
      column: first,
      fn: "avg",
      type: "none",
      multi: false,
    };
  return {
    ...base,
    kind,
    column: first,
    column2: numeric.find((c) => c !== first) ?? first,
    multi: false,
  };
}

/** 축을 바꾼 선. 기준선 값은 그 축의 모양(숫자·시각)으로 바꾸고, Left가 아니면 구간별을 끈다. */
export function withAxis(
  line: LimitLine,
  axis: LimitAxis,
  xType: ColumnType | undefined,
): LimitLine {
  if (line.kind === "reference") {
    const time = isTimeValue({ axis }, xType);
    const value =
      time === (typeof line.value === "string") ? line.value : time ? "" : 0;
    return { ...line, axis, value };
  }
  return { ...line, axis, multi: axis === "left" && line.multi };
}

// ── 시계열 기준선 값 ────────────────────────────────────────────────
// 화면의 시각은 KST로 보인다(shared/lib/format). 입력 칸도 KST로 받아 ISO 시각(+09:00)으로 저장한다.

const KST_OFFSET_MS = 9 * 3_600_000;

/** 저장한 ISO 시각 → datetime-local 칸 값 (KST). 읽을 수 없으면 "" */
export function isoToKstInput(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** datetime-local 칸 값 (KST) → ISO 시각. 비우면 "" (저장하지 못하는 값이라 사유를 보인다) */
export function kstInputToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "";
  const seconds = value.length === 16 ? ":00" : "";
  return `${value}${seconds}+09:00`;
}

// ── 사유 ──────────────────────────────────────────────────────────

/** 선 하나가 맞지 않는 까닭 (지금 언어). 그리는 컴포넌트는 useLingui로 언어 변경을 구독한다. */
export function limitIssueText(issue: LimitIssue): string {
  const axis = (a: LimitAxis) => (a === "left" ? "Left" : "Bottom");
  switch (issue.code) {
    case "name-empty":
      return t`이름을 적어 주세요.`;
    case "name-duplicate":
      return t`같은 이름의 선이 이미 있습니다.`;
    case "kind-axis": {
      const name = axis(issue.axis);
      return t({
        message: `이 차트의 ${name} 축에는 이 종류의 선을 쓸 수 없습니다.`,
        comment: "name: 축 이름(Left, Bottom). 번역하지 않는다",
      });
    }
    case "multi":
      return t`구간별 값은 scatter·line의 Left 축에서만 쓸 수 있습니다.`;
    case "value-time":
      return t`시각을 적어 주세요.`;
    case "value-number":
      return t`값을 숫자로 적어 주세요.`;
    case "column-missing": {
      const column = issue.column;
      return column
        ? t({
            message: `데이터에 없는 컬럼입니다: ${column}`,
            comment: "column: 컬럼 이름",
          })
        : t`컬럼을 골라 주세요.`;
    }
    case "column-type": {
      const column = issue.column;
      return t({
        message: `숫자 컬럼이 아닙니다: ${column}`,
        comment: "column: 컬럼 이름",
      });
    }
    case "band-same":
      return t`띠에는 서로 다른 두 컬럼을 골라 주세요.`;
    case "spec-duplicate": {
      const name = axis(issue.axis);
      const type = issue.type.toUpperCase();
      return t({
        message: `USL·LSL은 축마다 하나씩만 정합니다 (${name} 축 ${type} 중복).`,
        comment:
          "name: 축 이름(Left, Bottom), type: USL 또는 LSL. 번역하지 않는다",
      });
    }
  }
}

/** 폼의 선 목록이 맞는지. 맞지 않으면 첫 사유 (확인 버튼을 막고 title로 보인다). */
export type LimitCheck = {
  issues: (LimitIssue | undefined)[];
  /** 저장할 수 없는 까닭. 없으면 undefined */
  blocked: string | undefined;
};

const OK: LimitCheck = { issues: [], blocked: undefined };

/**
 * 폼의 선 목록을 서버와 같은 규칙으로 본다. 관리선을 쓰지 않는 차트면 보지 않는다 (서버도 보지 않는다).
 * 그리는 컴포넌트는 useLingui로 언어 변경을 구독한다.
 */
export function useLimitCheck(source: LimitSource | undefined): LimitCheck {
  const { control } = useFormContext<OptionsFormValues>();
  const lines = useWatch({ control, name: "options.controlLimit.lines" });
  return checkLimitLines(lines, source);
}

/** useLimitCheck의 계산. 폼 context 밖(전체 설정 팝업의 확인 버튼)과 선 목록이 함께 쓴다. */
export function checkLimitLines(
  lines: readonly LimitLine[] | undefined,
  source: LimitSource | undefined,
): LimitCheck {
  // 스키마를 받기 전에는 x 타입(Bottom 축에 쓸 수 있는 종류·값 모양)을 몰라 막지 않는다. 서버가 다시 본다.
  if (!lines?.length || !source?.support || !source.columns) return OK;
  const issues = limitIssues(lines, {
    support: source.support,
    columns: source.columns,
    xType: source.xType,
  });
  const index = issues.findIndex((issue) => issue !== undefined);
  const first = issues[index];
  if (lines.length > MAX_LIMIT_LINES) {
    const max = MAX_LIMIT_LINES;
    return { issues, blocked: t`관리선은 ${max}개까지입니다.` };
  }
  if (!first) return { issues, blocked: undefined };
  const name = lines[index].name.trim() || String(index + 1);
  const reason = limitIssueText(first);
  return {
    issues,
    blocked: t({
      message: `관리선 ${name}: ${reason}`,
      comment: "name: 선 이름(없으면 순번), reason: 맞지 않는 까닭",
    }),
  };
}
