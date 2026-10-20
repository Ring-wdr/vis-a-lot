// data·chart 서비스가 함께 쓰는 데이터셋 계약 (행 수, 컬럼, 집계 함수).

import { z } from "@hono/zod-openapi";
import {
  AGG_FNS,
  COLUMN_TYPES,
  COLUMNS,
  type ColumnName,
  DATASET_ID,
  LEGEND_COLUMNS,
  ROW_SIZES,
} from "../../data/schema";

export const DatasetIdSchema = z.literal(DATASET_ID).openapi("DatasetId");

export const RowSizeSchema = z
  .union([
    z.literal(ROW_SIZES[0]),
    z.literal(ROW_SIZES[1]),
    z.literal(ROW_SIZES[2]),
  ])
  .openapi("RowSize");

/** 쿼리 문자열의 행 수 */
export const RowSizeQuerySchema = z.coerce
  .number()
  .pipe(RowSizeSchema)
  .openapi({
    param: { name: "rows", in: "query" },
    type: "integer",
    enum: [...ROW_SIZES],
  });

const COLUMN_NAMES = COLUMNS.map((c) => c.name) as [
  ColumnName,
  ...ColumnName[],
];

export const ColumnNameSchema = z.enum(COLUMN_NAMES).openapi("ColumnName");
export const ColumnTypeSchema = z.enum(COLUMN_TYPES).openapi("ColumnType");
export const LegendColumnSchema = z
  .enum(LEGEND_COLUMNS)
  .openapi("LegendColumn");
export const AggFnSchema = z.enum(AGG_FNS).openapi("AggFn");

export const DatasetPathSchema = z.object({
  datasetId: DatasetIdSchema.openapi({
    param: { name: "datasetId", in: "path" },
  }),
});

/** 숫자·시계열 컬럼 범위 필터. 시계열 값은 epoch ms. inverse면 범위 밖을 남긴다. */
export const RangeFilterSchema = z
  .object({
    kind: z.literal("range"),
    column: ColumnNameSchema,
    min: z.number(),
    max: z.number(),
    inverse: z.boolean(),
    includeNull: z.boolean(),
  })
  .refine((f) => f.min <= f.max, "min must be <= max")
  .openapi("RangeFilter");

/** 범주 컬럼 필터: 고른 값을 뺀다 (기본은 전부 포함). */
export const ExcludeFilterSchema = z
  .object({
    kind: z.literal("exclude"),
    column: ColumnNameSchema,
    values: z.array(z.string()).max(50_000),
  })
  .openapi("ExcludeFilter");

export const ChartFilterSchema = z
  .union([RangeFilterSchema, ExcludeFilterSchema])
  .openapi("ChartFilter");

export const FiltersSchema = z
  .array(ChartFilterSchema)
  .max(COLUMNS.length)
  .refine(
    (fs) => new Set(fs.map((f) => f.column)).size === fs.length,
    "one filter per column",
  );
