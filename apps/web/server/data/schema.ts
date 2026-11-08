// IoT 센서 데이터 생성기의 raw data 정의와 데이터셋 공통 상수.
// 컬럼 정의(COLUMNS)는 생성기가 테이블을 만들 때만 쓴다. 나머지 코드는 적재된 테이블의 스키마를
// 읽어(dataset-schema.ts) 컬럼과 타입을 안다. 그래야 컬럼 이름이 다른 데이터가 들어와도 그대로 동작한다.

/** 2: 컬럼 라벨을 컬럼 주석(comment)으로 남긴다. */
export const GENERATOR_VERSION = 2;
export const SEED = 20261020;

export const ROW_SIZES = [100_000, 500_000, 1_000_000] as const;

/** bar의 통계 함수 */
export const AGG_FNS = ["avg", "sum", "count", "min", "max", "median"] as const;
export type AggFn = (typeof AGG_FNS)[number];

export const AGG_LABELS: Record<AggFn, string> = {
  avg: "평균",
  sum: "합계",
  count: "개수",
  min: "최솟값",
  max: "최댓값",
  median: "중앙값",
};

/** split by 조합(= item)의 최대 개수 */
export const MAX_SPLIT_ITEMS = 30_000;
export type RowSize = (typeof ROW_SIZES)[number];

/**
 * 샘플(생성기) 데이터셋. id가 행 수를 정한다. 업로드한 데이터셋은 `up-`로 시작하는 id를 받는다.
 * 예전 기록(spec.rows)은 sampleIdOf로 id를 찾는다.
 */
export const SAMPLES = [
  { id: "iot-100k", rows: 100_000, name: "IoT 센서 · 10만 행" },
  { id: "iot-500k", rows: 500_000, name: "IoT 센서 · 50만 행" },
  { id: "iot-1m", rows: 1_000_000, name: "IoT 센서 · 100만 행" },
] as const satisfies readonly { id: string; rows: RowSize; name: string }[];

export type SampleId = (typeof SAMPLES)[number]["id"];
export const DEFAULT_DATASET: SampleId = SAMPLES[0].id;

export function sampleOf(id: string) {
  return SAMPLES.find((s) => s.id === id);
}

export function sampleIdOf(rows: number): SampleId | undefined {
  return SAMPLES.find((s) => s.rows === rows)?.id;
}

export const COLUMN_TYPES = ["time", "string", "number"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export type ColumnDef = { name: string; type: ColumnType; label: string };

/** 순서가 곧 테이블 컬럼 순서이자 COPY CSV의 필드 순서다. */
export const COLUMNS = [
  { name: "ts", type: "time", label: "측정 시각" },
  { name: "factory", type: "string", label: "공장" },
  { name: "line", type: "string", label: "라인" },
  { name: "machine", type: "string", label: "설비" },
  { name: "sensor_type", type: "string", label: "센서 종류" },
  { name: "shift", type: "string", label: "근무조" },
  { name: "lot_id", type: "string", label: "LOT" },
  { name: "status", type: "string", label: "상태" },
  { name: "value", type: "number", label: "측정값" },
  { name: "temperature_env", type: "number", label: "주변 온도" },
  { name: "load_pct", type: "number", label: "부하율(%)" },
] as const satisfies readonly ColumnDef[];

export type ColumnName = (typeof COLUMNS)[number]["name"];

export function readingsTable(rows: RowSize) {
  return `readings_${rows}`;
}
