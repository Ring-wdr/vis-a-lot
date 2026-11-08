// 데이터셋 화면 설정. 값의 종류(통계 함수)는 OAS에서 생성한 타입이 정하고,
// 이름표처럼 화면에만 필요한 정보를 여기에 둔다. 서버가 값을 늘리면 Record가 빠진 키로 컴파일 에러를 낸다.
// 컬럼은 데이터마다 달라 여기 두지 않고 데이터셋 스키마 API에서 받는다.

// 데이터셋 목록(샘플·업로드)은 data 서비스의 GET /datasets에서 받는다.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { AggFn, DatasetId } from "@/shared/api/types";
import { linguiFor } from "@/shared/lib/i18n";
import "@/shared/config/messages";

/** 새 gallery 탭의 기본 데이터: 가장 작은 샘플 */
export const DEFAULT_DATASET: DatasetId = "iot-100k";

/** 행 수로 데이터셋을 구분하던 예전 공유 링크용 */
const LEGACY_ROWS: Record<number, DatasetId> = {
  100000: "iot-100k",
  500000: "iot-500k",
  1000000: "iot-1m",
};

export function legacyDatasetOf(rows: number): DatasetId {
  return LEGACY_ROWS[rows] ?? DEFAULT_DATASET;
}

const AGG_NAMES: Record<AggFn, MessageDescriptor> = {
  avg: msg`평균`,
  sum: msg`합계`,
  count: msg`개수`,
  min: msg`최솟값`,
  max: msg`최댓값`,
  median: msg`중앙값`,
};

/** 통계 함수의 지금 언어 이름. 그리는 컴포넌트는 useLocale로 구독한다. */
export const aggLabel = (fn: AggFn) => linguiFor()._(AGG_NAMES[fn]);
export const AGG_FNS = Object.keys(AGG_NAMES) as AggFn[];
