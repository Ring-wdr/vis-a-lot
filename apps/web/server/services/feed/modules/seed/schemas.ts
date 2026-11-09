// 피드 seed API 스키마: JSON 백업·복원.

import { z } from "@hono/zod-openapi";

/** 피드 스키마 전체. 테이블 이름 → 행 배열 (컬럼은 DDL 그대로, snake_case) */
export const FeedSnapshotSchema = z
  .object({
    schemaVersion: z.number().int(),
    exportedAt: z.string(),
    tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  })
  .openapi("FeedSnapshot");

export const SeedImportResponseSchema = z
  .object({ rows: z.number().int() })
  .openapi("SeedImportResponse");

export type FeedSnapshot = z.infer<typeof FeedSnapshotSchema>;
