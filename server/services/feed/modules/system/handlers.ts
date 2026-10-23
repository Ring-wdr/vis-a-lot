// 피드 system API handler.

import { getRuntime } from "../../../../runtime";
import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import { clockOffsetMs, feedNow, setClockOffsetMs } from "../../clock";
import * as routes from "./routes";

const clock = () => ({
  offsetMs: clockOffsetMs(),
  now: new Date(feedNow()).toISOString(),
});

export function registerSystem(app: FeedApp) {
  return app
    .openapi(routes.getSystemStatus, async (c) =>
      c.json(await feedCall(c, "system.status", undefined), 200),
    )
    .openapi(routes.bootstrapSystem, async (c) => {
      const status = await feedCall(c, "system.status", undefined);
      if (status.users > 0) return c.json(status, 200);
      await feedCall(c, "seed.load", { scenario: "default" });
      return c.json(await feedCall(c, "system.status", undefined), 200);
    })
    .openapi(routes.resetSystem, async (c) => {
      await getRuntime().db.call("feedReset", undefined);
      await feedCall(c, "seed.load", { scenario: "default" });
      return c.json(await feedCall(c, "system.status", undefined), 200);
    })
    .openapi(routes.getSystemClock, (c) => c.json(clock(), 200))
    .openapi(routes.setSystemClock, (c) => {
      setClockOffsetMs(c.req.valid("json").offsetMs);
      return c.json(clock(), 200);
    });
}
