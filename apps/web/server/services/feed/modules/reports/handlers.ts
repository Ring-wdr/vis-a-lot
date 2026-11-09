// 피드 reports API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerReports(app: FeedApp) {
  return app
    .openapi(routes.activityReport, async (c) =>
      c.json(await feedCall(c, "reports.activity", c.req.valid("json")), 200),
    )
    .openapi(routes.statusReport, async (c) =>
      c.json(await feedCall(c, "reports.status", c.req.valid("json")), 200),
    )
    .openapi(routes.listReportTemplates, async (c) =>
      c.json(
        await feedCall(c, "reports.templates.list", c.req.valid("query")),
        200,
      ),
    )
    .openapi(routes.saveReportTemplate, async (c) =>
      c.json(
        await feedCall(c, "reports.templates.save", c.req.valid("json")),
        200,
      ),
    )
    .openapi(routes.deleteReportTemplate, async (c) => {
      await feedCall(c, "reports.templates.delete", c.req.valid("param"));
      return c.body(null, 204);
    });
}
