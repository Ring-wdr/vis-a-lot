/**
 * 범주 i 안에서 g번째 막대/상자의 가운데 x와 너비. 서버 렌더러와 같은 계산이며,
 * 간격(groupGap)은 metadata로 받아 서버 값과 어긋나지 않게 한다.
 */
export function groupSlot(
  center: number,
  markWidth: number,
  groupCount: number,
  g: number,
  groupGap: number,
) {
  const slot = markWidth / groupCount;
  return {
    cx: center - markWidth / 2 + slot * (g + 0.5),
    width: Math.max(1, slot - (groupCount > 1 ? groupGap : 0)),
  };
}
