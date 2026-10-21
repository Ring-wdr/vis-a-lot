import { z } from "@hono/zod-openapi";
import {
  ColumnNameSchema,
  ColumnTypeSchema,
  DatasetIdSchema,
  FiltersSchema,
} from "../common/dataset";

export const CsvOptionsSchema = z
  .object({
    /** 한 글자 구분 기호 */
    delimiter: z.string().min(1).max(2),
    /** 첫 번째 행이 헤더인지 */
    header: z.boolean(),
    /** 이 값과 같은 필드는 null로 적재한다 */
    nullValue: z.string().max(20),
    /** 컬럼별로 직접 정한 타입. 없는 컬럼은 값으로 추론한다 */
    types: z.record(z.string(), ColumnTypeSchema).optional(),
  })
  .openapi("CsvOptions");

export const UploadInfoSchema = z
  .object({
    fileName: z.string(),
    size: z.number(),
    /** 적재한 CSV 파일들. zip이면 여러 개다 */
    files: z.array(z.object({ name: z.string(), size: z.number() })),
    createdAt: z.number(),
    options: CsvOptionsSchema,
    /** 컬럼 순서대로, 값으로 추론한 타입 (직접 정한 타입과 상관없이) */
    inferred: z.array(z.object({ name: z.string(), type: ColumnTypeSchema })),
  })
  .openapi("UploadInfo");

export const DatasetStatusSchema = z
  .object({
    id: DatasetIdSchema,
    kind: z.enum(["sample", "upload"]),
    name: z.string(),
    state: z.enum(["missing", "generating", "ready", "failed"]),
    /** generating일 때: copy(행 적재) → analyze(컬럼 통계) */
    phase: z.enum(["copy", "analyze"]).optional(),
    done: z.number(),
    total: z.number(),
    generateMs: z.number().optional(),
    /** failed일 때 사유 */
    error: z.string().optional(),
    upload: UploadInfoSchema.optional(),
  })
  .openapi("DatasetStatus");

export const DatasetListResponseSchema = z
  .object({ datasets: z.array(DatasetStatusSchema) })
  .openapi("DatasetListResponse");

/** multipart 업로드. options는 CsvOptions JSON 문자열이다 */
export const UploadDatasetRequestSchema = z
  .object({
    file: z
      .instanceof(File)
      .openapi({ type: "string", format: "binary" })
      .refine((f) => f.size > 0, "empty file"),
    name: z.string().trim().min(1).max(100),
    options: z.string().openapi({ description: "CsvOptions JSON" }),
  })
  .openapi("UploadDatasetRequest");

export const EditDatasetRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    /** 바꾸면 원본으로 다시 검사·적재한다 */
    options: CsvOptionsSchema.optional(),
  })
  .openapi("EditDatasetRequest");

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
    id: DatasetIdSchema,
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
