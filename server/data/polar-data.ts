// pie / radar 데이터. 집계는 bar와 같은 SQL(queryBarData)로 하고, 여기서는 조각·축을 고르기만 한다.
// 범주는 split item마다 다를 수 있어(예: 공장별 설비) 상위 N은 item 안에서 고른다.

import type { CategoryData } from "./category-data";

/** 이름을 붙여 그리는 조각 수. 팔레트가 8색이라 나머지는 '기타' 하나로 묶는다. */
export const PIE_TOP_SLICES = 8;
/** 상위 조각에 들지 못한 범주를 묶은 조각 */
export const OTHERS_SLICE = "기타";

export type PieSliceValue = { category: string; value: number };

export type PieGroup = {
  /** split 컬럼 순서대로의 값 */
  values: string[];
  /** 큰 순. '기타'는 크기와 상관없이 끝에 둔다. 0 이하인 조각은 없다. */
  slices: PieSliceValue[];
};

export type PieData = {
  groups: PieGroup[];
  /**
   * 기본 색 순서. 모든 item의 이름 붙은 조각을 합쳐도 팔레트(8색)에 들어가면 전체 합계 큰 순 목록을 주어
   * item끼리 같은 범주가 같은 색이 되게 한다. 넘치면 null이고, item 안의 조각 순서대로 색을 준다.
   */
  colorOrder: string[] | null;
};

const positive = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * bar 집계(legend 없음)를 pie 조각으로 바꾼다. 음수·0·빈 값은 비율을 낼 수 없어 뺀다.
 * item 안에서 큰 순으로 top개만 이름을 붙이고, 나머지는 '기타'로 더해 끝에 둔다.
 */
export function toPieData(data: CategoryData, top = PIE_TOP_SLICES): PieData {
  const totals = new Map<string, number>();
  const groups = data.groups.map((group) => {
    const ranked: PieSliceValue[] = [];
    group.categories.forEach((category, i) => {
      const value = group.bars?.[i]?.[0];
      if (positive(value)) ranked.push({ category, value });
    });
    // sort는 안정 정렬이라 같은 값은 원래(SQL) 순서대로 남는다.
    ranked.sort((a, b) => b.value - a.value);
    const slices = ranked.slice(0, top);
    const rest = ranked.slice(top).reduce((sum, s) => sum + s.value, 0);
    for (const s of slices)
      totals.set(s.category, (totals.get(s.category) ?? 0) + s.value);
    if (rest > 0) slices.push({ category: OTHERS_SLICE, value: rest });
    return { values: group.values, slices };
  });
  const order = [...totals].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return { groups, colorOrder: order.length <= top ? order : null };
}
