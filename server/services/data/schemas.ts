import { z } from "@hono/zod-openapi";
import {
  ColumnNameSchema,
  ColumnTypeSchema,
  FiltersSchema,
  RowSizeSchema,
} from "../common/dataset";

export const DatasetStatusSchema = z
  .object({
    rows: RowSizeSchema,
    state: z.enum(["missing", "generating", "ready"]),
    /** generating일 때: copy(행 적재) → analyze(컬럼 통계) */
    phase: z.enum(["copy", "analyze"]).optional(),
    done: z.number(),
    total: z.number(),
    generateMs: z.number().optional(),
  })
  .openapi("DatasetStatus");

export const DatasetListResponseSchema = z
  .object({ datasets: z.array(DatasetStatusSchema) })
  .openapi("DatasetListResponse");

export const GenerateDatasetRequestSchema = z
  .object({ rows: RowSizeSchema })
  .openapi("GenerateDatasetRequest");

/** 컬럼 하나: 이름, 화면 라벨(컬럼 주석, 없으면 이름), 논리 타입, null 허용, 고유값 수(적재 후) */
export const ColumnInfoSchema = z
  .object({
    name: ColumnNameSchema,
    label: z.string(),
    type: ColumnTypeSchema,
    nullable: z.boolean(),
    /** 적재가 끝나야 알 수 있다. 그 전에는 null */
    distinct: z.number().nullable(),
  })
  .openapi("ColumnInfo");

export const DatasetSchemaResponseSchema = z
  .object({
    rows: RowSizeSchema,
    /** 적재가 끝나 조회·집계·고유값을 쓸 수 있는지 */
    ready: z.boolean(),
    columns: z.array(ColumnInfoSchema),
  })
  .openapi("DatasetSchema");

export const SplitCountResponseSchema = z
  .object({
    count: z.number(),
    /** false면 컬럼별 고유값 곱으로 낸 상한이다. */
    exact: z.boolean(),
    limit: z.number(),
  })
  .openapi("SplitCountResponse");

export const LegendValuesResponseSchema = z
  .object({ column: ColumnNameSchema, values: z.array(z.string()) })
  .openapi("LegendValuesResponse");

export const DataHealthSchema = z
  .object({
    service: z.literal("data"),
    db: z.object({
      version: z.string(),
      bootCount: z.number(),
      bootMs: z.number(),
    }),
  })
  .openapi("DataHealth");

export const SplitCountRequestSchema = z
  .object({
    rows: RowSizeSchema,
    cols: z.array(ColumnNameSchema),
    filters: FiltersSchema.optional(),
  })
  .openapi("SplitCountRequest");

export const ColumnSummarySchema = z
  .union([
    z.object({
      kind: z.literal("range"),
      column: ColumnNameSchema,
      type: z.enum(["numeric", "datetime"]),
      /** 값이 하나도 없으면 null. 시계열은 epoch ms */
      min: z.number().nullable(),
      max: z.number().nullable(),
      nullCount: z.number(),
      count: z.number(),
    }),
    z.object({
      kind: z.literal("values"),
      column: ColumnNameSchema,
      /** 값 순서대로, 값마다 행 수 */
      values: z.array(z.object({ value: z.string(), count: z.number() })),
      nullCount: z.number(),
      count: z.number(),
    }),
  ])
  .openapi("ColumnSummary");
