// 피드 views API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerViews(app: FeedApp) {
  return app
    .openapi(routes.listViews, async (c) =>
      c.json(await feedCall(c, "views.list", c.req.valid("query")), 200),
    )
    .openapi(routes.getView, async (c) =>
      c.json(await feedCall(c, "views.get", c.req.valid("param")), 200),
    )
    .openapi(routes.saveView, async (c) =>
      c.json(await feedCall(c, "views.save", c.req.valid("json")), 200),
    )
    .openapi(routes.deleteView, async (c) => {
      await feedCall(c, "views.delete", c.req.valid("param"));
      return c.body(null, 204);
    })
    .openapi(routes.pinView, async (c) =>
      c.json(
        await feedCall(c, "views.pin", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    );
}
