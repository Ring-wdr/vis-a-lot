// 피드 notifications API 스키마: 알림함, 알림 설정(이벤트 × 채널), 발송 로그.

import { z } from "@hono/zod-openapi";
import { InstantSchema, PostRefSchema } from "../common";
import { FeedEventSchema } from "../posts/schemas";

/** 사용자가 채널을 고르는 알림 이벤트 (docs/feed-prototype-spec.md 알림 표) */
export const NotifyKindSchema = z
  .enum([
    "assigned",
    "mention",
    "comment",
    "status",
    "review_requested",
    "approved",
    "rejected",
    "due_soon",
    "overdue",
    "hold_resumed",
    "unblocked",
    "children_resolved",
  ])
  .openapi("NotifyKind");

export const NotificationSchema = z
  .object({
    id: z.string(),
    kind: NotifyKindSchema,
    event: FeedEventSchema,
    readAt: InstantSchema.nullable(),
    archivedAt: InstantSchema.nullable(),
    createdAt: InstantSchema,
  })
  .openapi("Notification");

/** 알림함은 게시물별로 묶는다 (최근 알림 순) */
export const InboxGroupSchema = z
  .object({
    post: PostRefSchema,
    notifications: z.array(NotificationSchema),
    unread: z.number().int(),
  })
  .openapi("InboxGroup");

export const InboxQuerySchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "unreadOnly", in: "query" } }),
  /** true면 보관한 것만, 아니면 보관하지 않은 것만 */
  archived: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "archived", in: "query" } }),
});

export const InboxResponseSchema = z
  .object({
    groups: z.array(InboxGroupSchema),
    /** 보관하지 않은 안읽음 전체 수 (배지) */
    unreadTotal: z.number().int(),
  })
  .openapi("InboxResponse");

export const NotificationIdsRequestSchema = z
  .object({ ids: z.array(z.string()).min(1).max(500) })
  .openapi("NotificationIdsRequest");

export const UnreadCountResponseSchema = z
  .object({ count: z.number().int() })
  .openapi("UnreadCountResponse");

export const NotificationSettingSchema = z
  .object({
    kind: NotifyKindSchema,
    inapp: z.boolean(),
    slack: z.boolean(),
    email: z.boolean(),
  })
  .openapi("NotificationSetting");

export const NotificationSettingsSchema = z
  .object({ settings: z.array(NotificationSettingSchema) })
  .openapi("NotificationSettings");

export const OutboxMessageSchema = z
  .object({
    id: z.string(),
    channel: z.enum(["slack", "email"]),
    recipient: z.string(),
    subject: z.string().nullable(),
    body: z.string(),
    createdAt: InstantSchema,
  })
  .openapi("OutboxMessage");

export const OutboxResponseSchema = z
  .object({ messages: z.array(OutboxMessageSchema) })
  .openapi("OutboxResponse");

export type NotifyKind = z.infer<typeof NotifyKindSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type InboxResponse = z.infer<typeof InboxResponseSchema>;
export type NotificationSetting = z.infer<typeof NotificationSettingSchema>;
export type OutboxMessage = z.infer<typeof OutboxMessageSchema>;
