// 피드 reports API 스키마: 활동 보고(무슨 일이 있었나), 현황 보고(지금 어디에 있나), 보고 템플릿.

import { z } from "@hono/zod-openapi";
import {
  DaySchema,
  InstantSchema,
  PostRefSchema,
  PostStatusSchema,
} from "../common";
import { FeedEventSchema, PostSummarySchema } from "../posts/schemas";

const ReportGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
});

export const ActivityReportRequestSchema = z
  .object({
    /** 그룹 id 또는 키 접두사 */
    groupId: z.string(),
    /** 포함 범위 (로컬 날짜) */
    from: DaySchema,
    to: DaySchema,
    teamId: z.string().optional(),
    /** 이 사람이 한 일(actor) 또는 이 사람이 담당인 게시물의 일 */
    assigneeId: z.string().optional(),
    postTypeIds: z.array(z.string()).optional(),
  })
  .openapi("ActivityReportRequest");

export const ActivityEntrySchema = z
  .object({ event: FeedEventSchema, post: PostRefSchema })
  .openapi("ActivityEntry");

export const ActivityReportSchema = z
  .object({
    group: ReportGroupSchema,
    from: DaySchema,
    to: DaySchema,
    /** 날짜 오름차순, 그날 이벤트는 시각 오름차순. 이벤트 없는 날은 뺀다 */
    days: z.array(
      z.object({ date: DaySchema, entries: z.array(ActivityEntrySchema) }),
    ),
    /** 기간 안에 해결된 게시물 */
    completed: z.array(
      z.object({
        post: PostRefSchema,
        assigneeId: z.string().nullable(),
        resolvedAt: InstantSchema,
      }),
    ),
    /** 기간 안에 만든 게시물 */
    created: z.array(PostRefSchema),
    /** 사람별 활동 수 (actor 기준) */
    byUser: z.array(
      z.object({
        userId: z.string(),
        events: z.number().int(),
        completed: z.number().int(),
      }),
    ),
  })
  .openapi("ActivityReport");

export const StatusReportRequestSchema = z
  .object({ groupId: z.string(), teamId: z.string().optional() })
  .openapi("StatusReportRequest");

export const StatusReportSchema = z
  .object({
    group: ReportGroupSchema,
    /** 지금 상태별 게시물 수 (지운 것 제외) */
    byStatus: z.record(PostStatusSchema, z.number().int()),
    /** 기한이 지난 열린 게시물 수 */
    overdue: z.number().int(),
    /** 담당자별 열린 게시물 수 (담당자 없음은 userId null) */
    assigneeLoad: z.array(
      z.object({
        userId: z.string().nullable(),
        open: z.number().int(),
        inReview: z.number().int(),
        overdue: z.number().int(),
      }),
    ),
    /** 지금 검토 중인 게시물이 검토 중으로 들어간 뒤 지난 시간 */
    reviewWait: z.object({
      count: z.number().int(),
      avgHours: z.number(),
      maxHours: z.number(),
    }),
    /** 최근 30일 해결된 게시물의 만든 시각 → 해결 시각 */
    leadTime30d: z.object({
      count: z.number().int(),
      avgDays: z.number(),
      medianDays: z.number(),
    }),
    /** 하단 목록: 열린·멈춘 게시물 (기한 지난 것 먼저, 그다음 기한순) */
    posts: z.array(PostSummarySchema),
  })
  .openapi("StatusReport");

export const ReportTemplateParamsSchema = z
  .object({
    /** 오늘을 끝으로 하는 기간 (일) */
    rangeDays: z.number().int().min(1).max(366),
    teamId: z.string(),
    assigneeId: z.string(),
    postTypeIds: z.array(z.string()),
  })
  .partial()
  .openapi("ReportTemplateParams");

export const ReportTemplateSchema = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    groupId: z.string(),
    name: z.string(),
    kind: z.enum(["activity", "status"]),
    params: ReportTemplateParamsSchema,
    /** 지금 사용자가 고치고 지울 수 있다 (만든 사람·그룹 관리자) */
    editable: z.boolean(),
  })
  .openapi("ReportTemplate");

export const ReportTemplateListQuerySchema = z.object({
  groupId: z.string().openapi({ param: { name: "groupId", in: "query" } }),
});

export const ReportTemplateListResponseSchema = z
  .object({ templates: z.array(ReportTemplateSchema) })
  .openapi("ReportTemplateListResponse");

export const SaveReportTemplateRequestSchema = z
  .object({
    id: z.string().optional(),
    groupId: z.string(),
    name: z.string().min(1).max(60),
    kind: z.enum(["activity", "status"]),
    params: ReportTemplateParamsSchema.default({}),
  })
  .openapi("SaveReportTemplateRequest");

export type ActivityReport = z.infer<typeof ActivityReportSchema>;
export type ActivityReportRequest = z.infer<typeof ActivityReportRequestSchema>;
export type StatusReport = z.infer<typeof StatusReportSchema>;
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;
export type SaveReportTemplateRequest = z.input<
  typeof SaveReportTemplateRequestSchema
>;
