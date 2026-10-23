// 피드 API의 공통 스키마: 상태·형식·우선순위 같은 값 목록과 게시물 참조.

import { z } from "@hono/zod-openapi";

export const PostStatusSchema = z
  .enum([
    "unresolved",
    "in_progress",
    "in_review",
    "resolved",
    "on_hold",
    "cancelled",
  ])
  .openapi("PostStatus");

/** 열림(미해결·진행 중·검토 중) / 멈춤(보류) / 닫힘(해결·취소). 고정 */
export const StatusCategorySchema = z
  .enum(["open", "paused", "closed"])
  .openapi("StatusCategory");

export const PostFormatSchema = z
  .enum(["chart", "image", "video", "code"])
  .openapi("PostFormat");

/** 0 없음 1 낮음 2 보통 3 높음 4 긴급 */
export const PrioritySchema = z
  .number()
  .int()
  .min(0)
  .max(4)
  .openapi("Priority");

export const CancelReasonSchema = z
  .enum(["duplicate", "cannot_reproduce", "out_of_scope", "low_priority"])
  .openapi("CancelReason");

export const HoldReasonSchema = z
  .enum(["dependency", "decision", "resource"])
  .openapi("HoldReason");

export const RelationKindSchema = z
  .enum(["blocks", "duplicate", "relates", "derived"])
  .openapi("RelationKind");

export const GroupRoleSchema = z.enum(["admin", "member"]).openapi("GroupRole");

/** 'YYYY-MM-DD' */
export const DaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi("Day", { example: "2026-10-23" });

/** ISO 8601 시각 */
export const InstantSchema = z.string().openapi("Instant");

/** 목록·관계·알림에서 가리키는 게시물 */
export const PostRefSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    title: z.string(),
    status: PostStatusSchema,
    groupId: z.string(),
  })
  .openapi("PostRef");

/**
 * 이름 붙인 스키마(.openapi("…"))의 nullable. `.nullable()`은 OAS에서 allOf로 나와
 * 생성 타입이 `Day`(null 빠짐)나 `PostRef & (… | null)`이 되므로 anyOf(T, null)로 적는다.
 */
export const orNull = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.null()]);

export const PathId = (name: string) =>
  z.string().openapi({ param: { name, in: "path" } });

export type PostStatus = z.infer<typeof PostStatusSchema>;
export type StatusCategory = z.infer<typeof StatusCategorySchema>;
export type PostRef = z.infer<typeof PostRefSchema>;
