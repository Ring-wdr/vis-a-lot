import type { ChartSpec, ColumnInfo } from "@/shared/api/types";
import { supports } from "@/shared/config/chart-kinds";

/**
 * 선택 값 구역(selection)이 아는 것. 여는 쪽(전체 설정은 draft, item 속성은 그린 spec)이 만들어 구역 폼에 넘긴다.
 * 선택 필드를 쓰지 않는 차트·하위 차트(분포 line)면 enabled가 false라 구역을 메뉴에 두지 않는다.
 */
export type SelectionSource = {
  enabled: boolean;
  /** 고를 수 있는 컬럼 (데이터셋 스키마 순서). 받기 전이면 undefined */
  columns: readonly ColumnInfo[] | undefined;
};

export function selectionSourceOf(
  spec: Pick<ChartSpec, "chartType" | "subType">,
  columns: readonly ColumnInfo[] | undefined,
): SelectionSource {
  return { enabled: supports(spec, "selectField"), columns };
}
