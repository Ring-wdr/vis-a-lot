// IoT 센서 데이터 생성기의 raw data 정의와 데이터셋 공통 상수.
// 컬럼 정의(COLUMNS)는 생성기가 테이블을 만들 때만 쓴다. 나머지 코드는 적재된 테이블의 스키마를
// 읽어(dataset-schema.ts) 컬럼과 타입을 안다. 그래야 컬럼 이름이 다른 데이터가 들어와도 그대로 동작한다.

export const DATASET_ID = "iot";
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

export function isRowSize(n: number): n is RowSize {
  return (ROW_SIZES as readonly number[]).includes(n);
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

const SQL_TYPES: Record<ColumnType, string> = {
  time: "timestamptz not null",
  string: "text not null",
  number: "double precision",
};

export function readingsTable(rows: RowSize) {
  return `readings_${rows}`;
}

/** 테이블과, 화면에 보일 컬럼 라벨(컬럼 주석)을 만든다. */
export function createReadingsSql(rows: RowSize) {
  const table = readingsTable(rows);
  const cols = COLUMNS.map((c) => `${c.name} ${SQL_TYPES[c.type]}`).join(
    ",\n  ",
  );
  const comments = COLUMNS.map(
    (c) =>
      `comment on column ${table}.${c.name} is '${c.label.replaceAll("'", "''")}'`,
  ).join(";\n");
  return `create table ${table} (\n  ${cols}\n);\n${comments}`;
}
