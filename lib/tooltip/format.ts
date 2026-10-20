import type { AxisMeta } from "@/server/api/types";
import { COLUMNS, type ColumnType } from "@/server/data/schema";

const KST_OFFSET_MS = 9 * 3_600_000;

/** 시계열은 KST "MM/DD HH:mm", 숫자는 소수 셋째 자리까지 */
export function formatValue(
  value: string | number | null | undefined,
  type: ColumnType | AxisMeta["kind"],
): string {
  if (value === null || value === undefined) return "—";
  if (type === "time") {
    const d = new Date(Number(value) + KST_OFFSET_MS);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  if (type === "number") {
    const n = Number(value);
    return Number.isInteger(n)
      ? n.toLocaleString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}

const COLUMN = new Map(COLUMNS.map((c) => [c.name as string, c]));

export function columnLabel(name: string) {
  return COLUMN.get(name)?.label ?? name;
}

export function columnType(name: string): ColumnType {
  return COLUMN.get(name)?.type ?? "string";
}
