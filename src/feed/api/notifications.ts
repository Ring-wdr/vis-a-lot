// 피드 notifications API: 알림함, 안읽음 수, 읽음·보관, 알림 설정, 발송 로그.

import { feedClient, unwrap } from "./client";
import type { NotificationSetting } from "./types";

export type InboxParams = { unreadOnly?: boolean; archived?: boolean };

const flag = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? ("true" as const) : ("false" as const);

export const notificationsApi = {
  inbox: ({ unreadOnly, archived }: InboxParams = {}) =>
    unwrap(
      feedClient.GET("/notifications", {
        params: {
          query: { unreadOnly: flag(unreadOnly), archived: flag(archived) },
        },
      }),
    ),
  unreadCount: () => unwrap(feedClient.GET("/notifications/unread-count")),
  markRead: (ids: string[]) =>
    unwrap(feedClient.POST("/notifications/read", { body: { ids } })),
  markUnread: (ids: string[]) =>
    unwrap(feedClient.POST("/notifications/unread", { body: { ids } })),
  archive: (ids: string[]) =>
    unwrap(feedClient.POST("/notifications/archive", { body: { ids } })),
  settings: () => unwrap(feedClient.GET("/notifications/settings")),
  saveSettings: (settings: NotificationSetting[]) =>
    unwrap(feedClient.PUT("/notifications/settings", { body: { settings } })),
  outbox: () => unwrap(feedClient.GET("/outbox")),
};
