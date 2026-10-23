// 피드 seed API handler.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerSeed(app: FeedApp) {
  return app
    .openapi(routes.exportSeed, async (c) =>
      c.json(await feedCall(c, "seed.export", undefined), 200),
    )
    .openapi(routes.importSeed, async (c) =>
      c.json(await feedCall(c, "seed.import", c.req.valid("json")), 200),
    );
}
