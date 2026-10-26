// 피드 search API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerSearch(app: FeedApp) {
  return app.openapi(routes.searchPosts, async (c) => {
    const { q, limit } = c.req.valid("query");
    return c.json(
      await feedCall(c, "search.posts", {
        q,
        limit: limit === undefined ? undefined : Number(limit),
      }),
      200,
    );
  });
}
