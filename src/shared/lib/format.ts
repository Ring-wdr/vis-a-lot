import type { AxisMeta, ColumnInfo, ColumnType } from "@/shared/api/types";

const KST_OFFSET_MS = 9 * 3_600_000;

/** 시각은 KST "MM/DD HH:mm", 숫자는 소수 셋째 자리까지 */
export function formatValue(
  value: string | number | null | undefined,
  type: ColumnType | AxisMeta["kind"],
): string {
  if (value === null || value === undefined) return "—";
  if (type === "datetime" || type === "time") {
    const d = new Date(Number(value) + KST_OFFSET_MS);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  if (type === "numeric" || type === "number") {
    const n = Number(value);
    return Number.isInteger(n)
      ? n.toLocaleString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}

/** 컬럼 이름으로 라벨과 타입을 찾는다. 컬럼은 데이터셋마다 다르므로 그 데이터셋의 스키마로 만든다. */
export type ColumnLookup = {
  label: (name: string) => string;
  type: (name: string) => ColumnType;
};

/** 스키마를 아직 받지 않았으면 컬럼 이름을 그대로 쓴다. */
export function columnLookup(
  columns: readonly ColumnInfo[] = [],
): ColumnLookup {
  const byName = new Map(columns.map((c) => [c.name, c]));
  return {
    label: (name) => byName.get(name)?.label ?? name,
    type: (name) => byName.get(name)?.type ?? "categorical",
  };
}
