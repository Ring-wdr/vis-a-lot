// 피드 seed API handler.

import { getRuntime } from "../../../../runtime";
import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerSeed(app: FeedApp) {
  return app
    .openapi(routes.exportSeed, async (c) =>
      c.json(await feedCall(c, "seed.export", undefined), 200),
    )
    .openapi(routes.importSeed, async (c) => {
      const result = await feedCall(c, "seed.import", c.req.valid("json"));
      // 데이터가 통째로 바뀌었으니 새로고침해도 남도록 기다린다
      await getRuntime().db.call("feedFlush", undefined);
      return c.json(result, 200);
    });
}
