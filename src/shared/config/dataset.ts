// 데이터셋 화면 설정. 값의 종류(컬럼, 행 수, 통계 함수)는 OAS에서 생성한 타입이 정하고,
// 이름표처럼 화면에만 필요한 정보를 여기에 둔다. 서버가 컬럼을 늘리면 Record가 빠진 키로 컴파일 에러를 낸다.

import type {
  AggFn,
  ColumnName,
  ColumnType,
  LegendColumn,
  RowSize,
} from "@/shared/api/types";

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

export type ColumnDef = { name: ColumnName; type: ColumnType; label: string };

/** 순서가 곧 화면의 컬럼 순서다. */
const COLUMN_DEFS: Record<ColumnName, Omit<ColumnDef, "name">> = {
  ts: { type: "time", label: "측정 시각" },
  factory: { type: "string", label: "공장" },
  line: { type: "string", label: "라인" },
  machine: { type: "string", label: "설비" },
  sensor_type: { type: "string", label: "센서 종류" },
  shift: { type: "string", label: "근무조" },
  lot_id: { type: "string", label: "LOT" },
  status: { type: "string", label: "상태" },
  value: { type: "number", label: "측정값" },
  temperature_env: { type: "number", label: "주변 온도" },
  load_pct: { type: "number", label: "부하율(%)" },
};
export const COLUMNS: ColumnDef[] = Object.entries(COLUMN_DEFS).map(
  ([name, def]) => ({ name: name as ColumnName, ...def }),
);

/** legend로 쓸 수 있는 컬럼 (고유값 8개 이하 범주 컬럼) */
const LEGEND_SET: Record<LegendColumn, true> = {
  factory: true,
  line: true,
  sensor_type: true,
  shift: true,
  status: true,
};
export const LEGEND_COLUMNS = Object.keys(LEGEND_SET) as LegendColumn[];
