// 피드 notifications API 정의. 모두 지금 사용자(x-feed-user)의 알림이다.

import { createRoute } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import {
  InboxQuerySchema,
  InboxResponseSchema,
  NotificationIdsRequestSchema,
  NotificationSettingsSchema,
  OutboxResponseSchema,
  UnreadCountResponseSchema,
} from "./schemas";

const auth = { 401: errorResponse("사용자를 고르지 않음") };
const done = jsonResponse(UnreadCountResponseSchema, "바꾼 뒤 안읽음 수");

export const getInbox = createRoute({
  method: "get",
  path: "/notifications",
  tags: ["notifications"],
  summary: "알림함 (게시물별 묶음)",
  security: FEED_USER,
  request: { query: InboxQuerySchema },
  responses: { 200: jsonResponse(InboxResponseSchema, "알림함"), ...auth },
});

export const getUnreadCount = createRoute({
  method: "get",
  path: "/notifications/unread-count",
  tags: ["notifications"],
  summary: "보관하지 않은 안읽음 수 (상단 배지)",
  security: FEED_USER,
  responses: { 200: jsonResponse(UnreadCountResponseSchema, "수"), ...auth },
});

export const markNotificationsRead = createRoute({
  method: "post",
  path: "/notifications/read",
  tags: ["notifications"],
  summary: "읽음 표시 (내 알림만)",
  security: FEED_USER,
  request: { body: jsonBody(NotificationIdsRequestSchema) },
  responses: { 200: done, ...auth },
});

export const markNotificationsUnread = createRoute({
  method: "post",
  path: "/notifications/unread",
  tags: ["notifications"],
  summary: "안읽음으로 되돌리기",
  security: FEED_USER,
  request: { body: jsonBody(NotificationIdsRequestSchema) },
  responses: { 200: done, ...auth },
});

export const archiveNotifications = createRoute({
  method: "post",
  path: "/notifications/archive",
  tags: ["notifications"],
  summary: "보관 (읽음도 함께 표시)",
  security: FEED_USER,
  request: { body: jsonBody(NotificationIdsRequestSchema) },
  responses: { 200: done, ...auth },
});

export const getNotificationSettings = createRoute({
  method: "get",
  path: "/notifications/settings",
  tags: ["notifications"],
  summary: "이벤트 × 채널 설정. 저장하지 않은 이벤트는 기본값",
  security: FEED_USER,
  responses: {
    200: jsonResponse(NotificationSettingsSchema, "설정"),
    ...auth,
  },
});

export const setNotificationSettings = createRoute({
  method: "put",
  path: "/notifications/settings",
  tags: ["notifications"],
  summary: "설정 저장 (보낸 이벤트만 덮어쓴다)",
  security: FEED_USER,
  request: { body: jsonBody(NotificationSettingsSchema) },
  responses: {
    200: jsonResponse(NotificationSettingsSchema, "저장 뒤 전체 설정"),
    400: errorResponse("요청 형식 오류"),
    ...auth,
  },
});

export const listOutbox = createRoute({
  method: "get",
  path: "/outbox",
  tags: ["notifications"],
  summary: "슬랙·이메일로 나갔을 메시지 (최근 순, 프로토타입 전용)",
  responses: { 200: jsonResponse(OutboxResponseSchema, "발송 로그") },
});
