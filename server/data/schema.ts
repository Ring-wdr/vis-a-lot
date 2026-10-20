// 데이터셋 정의. 화면, API, 생성기가 모두 이 정의를 공유한다.

export const DATASET_ID = "iot";
export const GENERATOR_VERSION = 1;
export const SEED = 20261020;

export const ROW_SIZES = [100_000, 500_000, 1_000_000] as const;

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

export function createReadingsSql(rows: RowSize) {
  const cols = COLUMNS.map((c) => `${c.name} ${SQL_TYPES[c.type]}`).join(
    ",\n  ",
  );
  return `create table ${readingsTable(rows)} (\n  ${cols}\n)`;
}
