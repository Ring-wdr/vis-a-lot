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
