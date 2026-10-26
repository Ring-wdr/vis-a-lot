// 피드 scheduler API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerScheduler(app: FeedApp) {
  return app.openapi(routes.runScheduler, async (c) =>
    c.json(await feedCall(c, "scheduler.run", undefined), 200),
  );
}
