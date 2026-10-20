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

/**
 * 받은 데이터셋 스키마의 컬럼 라벨과 타입. 컬럼은 데이터마다 다르므로 스키마를 받을 때마다 채우고,
 * history 목록이나 툴팁처럼 스키마를 직접 들고 있지 않은 곳이 이름으로 찾아 쓴다.
 */
const known = new Map<string, Pick<ColumnInfo, "label" | "type">>();

export function registerColumns(columns: readonly ColumnInfo[]) {
  for (const c of columns) known.set(c.name, { label: c.label, type: c.type });
}

/** 스키마를 아직 받지 않았으면 컬럼 이름을 그대로 쓴다. */
export function columnLabel(name: string) {
  return known.get(name)?.label ?? name;
}

export function columnType(name: string): ColumnType {
  return known.get(name)?.type ?? "categorical";
}
