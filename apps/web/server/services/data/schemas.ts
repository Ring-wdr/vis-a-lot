import { z } from "@hono/zod-openapi";
import { UPLOAD_TASK_STATES } from "../../api/types";
import { CSV_ENCODINGS } from "../../data/csv-import";
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
    /** 값을 감싸는 한 글자 따옴표 */
    quote: z.string().min(1).max(2),
    /** auto: UTF-8, 깨지면 EUC-KR */
    encoding: z.enum(CSV_ENCODINGS),
    /** 시계열 값 형식 (yyyy-MM-dd HH:mm:ss 등). null이면 ISO 형식만 시계열로 본다 */
    datetimeFormat: z.string().min(1).max(40).nullable(),
    /** 켜면 타입으로 바꿀 수 없는 값은 null, 필드 수가 맞지 않는 행은 건너뛴다 */
    ignoreErrors: z.boolean(),
    /** 컬럼별로 직접 정한 타입. 없는 컬럼은 값으로 추론한다 */
    types: z.record(z.string(), ColumnTypeSchema).optional(),
    /** 적재하지 않을 컬럼 */
    excluded: z.array(z.string()).optional(),
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

/** multipart로 파일만 올려 둔다. 옵션은 미리보기·검사·확인에서 정한다 */
export const StageUploadRequestSchema = z
  .object({
    file: z
      .instanceof(File)
      .openapi({ type: "string", format: "binary" })
      .refine((f) => f.size > 0, "empty file"),
  })
  .openapi("StageUploadRequest");

export const StagedUploadSchema = z
  .object({
    stageId: z.string(),
    fileName: z.string(),
    size: z.number(),
    /** 파일 안의 CSV. zip이면 여러 개다 */
    files: z.array(z.object({ name: z.string(), size: z.number() })),
    /** 기존 데이터셋을 다시 적재(수정)하는 중이면 그 데이터셋의 이름과 옵션 */
    dataset: z
      .object({
        id: DatasetIdSchema,
        name: z.string(),
        options: CsvOptionsSchema,
      })
      .optional(),
  })
  .openapi("StagedUpload");

export const StagePathSchema = z.object({
  stageId: z
    .string()
    .regex(/^st-[a-z0-9]{1,20}$/, "invalid stage id")
    .openapi({ param: { name: "stageId", in: "path" } }),
});

export const PreviewUploadRequestSchema = z
  .object({
    /** 미리볼 파일 순번 (zip 안의 CSV) */
    file: z.number().int().min(0),
    options: CsvOptionsSchema,
  })
  .openapi("PreviewUploadRequest");

export const CsvPreviewSchema = z
  .object({
    /** 파일 앞부분의 원본 줄 */
    raw: z.array(z.string()),
    columns: z.array(
      z.object({
        name: z.string(),
        /** 미리보기 행으로 추론한 타입 */
        inferred: ColumnTypeSchema,
        type: ColumnTypeSchema,
      }),
    ),
    /** 정한 타입으로 바꾼 앞쪽 행. null 값은 null, 바꿀 수 없는 값은 원래 값 */
    rows: z.array(z.array(z.string().nullable())),
    /** 바꿀 수 없었던 칸 [행, 열] */
    invalid: z.array(z.tuple([z.number(), z.number()])),
    /** 파싱 중 거절 사유 */
    error: z.string().optional(),
  })
  .openapi("CsvPreview");

export const CheckUploadRequestSchema = z
  .object({ options: CsvOptionsSchema })
  .openapi("CheckUploadRequest");

export const CsvCheckSchema = z
  .object({
    rows: z.number(),
    /** 데이터 오류 무시로 건너뛴 행 수 */
    skipped: z.number(),
    columns: z.array(
      z.object({
        name: z.string(),
        type: ColumnTypeSchema,
        inferred: ColumnTypeSchema,
        included: z.boolean(),
        /** 타입으로 바꿀 수 없어 null로 넣을 값 수 */
        invalid: z.number(),
      }),
    ),
  })
  .openapi("CsvCheck");

export const CommitUploadRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    options: CsvOptionsSchema,
  })
  .openapi("CommitUploadRequest");

export const UploadTaskSchema = z
  .object({
    /** parse(검사·변환) → queued → copy → analyze → done. rejected는 거절, failed는 적재 실패 */
    state: z.enum(UPLOAD_TASK_STATES),
    /** parse는 글자 수, copy는 행 수 */
    done: z.number(),
    total: z.number(),
    /** long polling의 since로 다시 보낸다 */
    version: z.number(),
    datasetId: DatasetIdSchema.optional(),
    error: z.string().optional(),
  })
  .openapi("UploadTask");

export const RenameDatasetRequestSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .openapi("RenameDatasetRequest");

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
