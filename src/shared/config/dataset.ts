// 데이터셋 화면 설정. 값의 종류(행 수, 통계 함수)는 OAS에서 생성한 타입이 정하고,
// 이름표처럼 화면에만 필요한 정보를 여기에 둔다. 서버가 값을 늘리면 Record가 빠진 키로 컴파일 에러를 낸다.
// 컬럼은 데이터마다 달라 여기 두지 않고 데이터셋 스키마 API에서 받는다.

import type { AggFn, RowSize } from "@/shared/api/types";

export const DATASET_ID = "iot";

const ROW_SIZE_SET: Record<RowSize, true> = {
  100000: true,
  500000: true,
  1000000: true,
};
export const ROW_SIZES = Object.keys(ROW_SIZE_SET).map(Number) as RowSize[];

export const AGG_LABELS: Record<AggFn, string> = {
  avg: "평균",
  sum: "합계",
  count: "개수",
  min: "최솟값",
  max: "최댓값",
  median: "중앙값",
};
export const AGG_FNS = Object.keys(AGG_LABELS) as AggFn[];
