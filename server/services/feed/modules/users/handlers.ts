// 피드 users API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerUsers(app: FeedApp) {
  return app
    .openapi(routes.listUsers, async (c) =>
      c.json(await feedCall(c, "users.list", undefined), 200),
    )
    .openapi(routes.getMe, async (c) =>
      c.json(await feedCall(c, "users.me", undefined), 200),
    )
    .openapi(routes.setUserAdmin, async (c) => {
      const { userId } = c.req.valid("param");
      const { on } = c.req.valid("json");
      return c.json(await feedCall(c, "users.setAdmin", { userId, on }), 200);
    })
    .openapi(routes.deactivateUser, async (c) => {
      const { userId } = c.req.valid("param");
      return c.json(await feedCall(c, "users.deactivate", { userId }), 200);
    })
    .openapi(routes.followUser, async (c) => {
      const { userId } = c.req.valid("param");
      const { on } = c.req.valid("json");
      return c.json(await feedCall(c, "users.follow", { userId, on }), 200);
    });
}
