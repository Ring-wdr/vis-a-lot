// 페이지 스크롤바의 기하 계산. 한 칸(thumb 한 번의 이동 단위)이 곧 한 페이지다.

/** thumb이 너무 작아 잡기 어려워지지 않도록 하는 최소 길이(px) */
export const MIN_THUMB_PX = 20;
/** 휠은 이만큼 굴릴 때마다 한 페이지씩 넘긴다(px). 트랙패드처럼 잘게 오는 값은 모아서 센다. */
export const WHEEL_STEP_PX = 100;

export function clampPage(page: number, totalPages: number) {
  return Math.min(totalPages - 1, Math.max(0, page));
}

/** thumb 길이: 한 화면(한 페이지)이 전체에서 차지하는 비율만큼. 페이지가 하나면 트랙 전체 */
export function thumbSize(track: number, totalPages: number) {
  if (totalPages <= 1) return track;
  return Math.min(track, Math.max(MIN_THUMB_PX, track / totalPages));
}

/** 페이지 → thumb 위쪽 위치 */
export function thumbTop(
  track: number,
  thumb: number,
  page: number,
  totalPages: number,
) {
  if (totalPages <= 1) return 0;
  return ((track - thumb) * clampPage(page, totalPages)) / (totalPages - 1);
}

/** thumb 위쪽 위치 → 가장 가까운 페이지 */
export function pageAt(
  track: number,
  thumb: number,
  top: number,
  totalPages: number,
) {
  const room = track - thumb;
  if (totalPages <= 1 || room <= 0) return 0;
  return clampPage(Math.round((top / room) * (totalPages - 1)), totalPages);
}

/**
 * 휠 이동량을 모아 넘길 페이지 수를 센다. 남은 양은 다음 휠에 이어서 쓴다.
 * 방향이 바뀌면 이전에 모은 양은 버린다.
 */
export function createWheelAccumulator(step = WHEEL_STEP_PX) {
  let acc = 0;
  return (deltaY: number) => {
    if (Math.sign(deltaY) !== Math.sign(acc)) acc = 0;
    acc += deltaY;
    // -0이 나오지 않도록 0을 더한다.
    const pages = Math.trunc(acc / step) + 0;
    acc -= pages * step;
    return pages;
  };
}
