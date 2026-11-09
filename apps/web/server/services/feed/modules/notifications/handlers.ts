// 피드 notifications API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerNotifications(app: FeedApp) {
  return app
    .openapi(routes.getInbox, async (c) => {
      const { unreadOnly, archived } = c.req.valid("query");
      return c.json(
        await feedCall(c, "notifications.inbox", {
          unreadOnly: unreadOnly === "true",
          archived: archived === "true",
        }),
        200,
      );
    })
    .openapi(routes.getUnreadCount, async (c) =>
      c.json(await feedCall(c, "notifications.unreadCount", undefined), 200),
    )
    .openapi(routes.markNotificationsRead, async (c) =>
      c.json(
        await feedCall(c, "notifications.markRead", c.req.valid("json")),
        200,
      ),
    )
    .openapi(routes.markNotificationsUnread, async (c) =>
      c.json(
        await feedCall(c, "notifications.markUnread", c.req.valid("json")),
        200,
      ),
    )
    .openapi(routes.archiveNotifications, async (c) =>
      c.json(
        await feedCall(c, "notifications.archive", c.req.valid("json")),
        200,
      ),
    )
    .openapi(routes.getNotificationSettings, async (c) =>
      c.json(await feedCall(c, "notifications.getSettings", undefined), 200),
    )
    .openapi(routes.setNotificationSettings, async (c) =>
      c.json(
        await feedCall(c, "notifications.setSettings", c.req.valid("json")),
        200,
      ),
    )
    .openapi(routes.listOutbox, async (c) =>
      c.json(await feedCall(c, "outbox.list", undefined), 200),
    );
}
