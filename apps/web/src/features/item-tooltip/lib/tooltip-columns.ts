import type { ColumnInfo, ColumnName } from "@/shared/api/types";

/**
 * 툴팁에 더 보여줄 컬럼. 왼쪽 패널의 tooltip 선택(draft)을 draw 없이 바로 따른다.
 * 값은 가리킨 행 id로 서버에서 읽으므로 다시 그릴 필요가 없다.
 * 패널에서 데이터셋을 바꿨으면 그린 차트의 데이터셋에 없는 컬럼은 읽을 수 없어 뺀다.
 * 그린 차트의 x, y는 이미 툴팁 줄로 보이므로 뺀다.
 * 스키마를 아직 받지 못했으면 아무것도 고르지 않는다 (없는 컬럼을 서버에 묻지 않는다).
 */
export function liveTooltipColumns(
  selected: readonly ColumnName[],
  drawnColumns: readonly ColumnInfo[] | undefined,
  drawn: { x: ColumnName; y: ColumnName } | undefined,
): ColumnName[] {
  if (!drawnColumns) return [];
  const names = new Set(drawnColumns.map((c) => c.name));
  return selected.filter(
    (c) => names.has(c) && c !== drawn?.x && c !== drawn?.y,
  );
}
