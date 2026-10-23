// 피드 서비스: 게시물(이슈)·그룹·사용자·알림·보고서. 요청 검증은 routes의 zod 스키마가, 규칙과 상태는 DB Worker의 op가 맡는다.
// 프로토타입이라 로그인 대신 x-feed-user 헤더로 사용자를 받는다.

import { HTTPException } from "hono/http-exception";
import { apiError, createServiceApp } from "../common/http";
import { registerGroups } from "./modules/groups/handlers";
import { registerNotifications } from "./modules/notifications/handlers";
import { registerPosts } from "./modules/posts/handlers";
import { registerScheduler } from "./modules/scheduler/handlers";
import { registerSeed } from "./modules/seed/handlers";
import { registerSystem } from "./modules/system/handlers";
import { registerUsers } from "./modules/users/handlers";
import { FEED_SECURITY_SCHEMES } from "./security";

function createFeedApp() {
  const app = createServiceApp();
  for (const [name, scheme] of Object.entries(FEED_SECURITY_SCHEMES))
    app.openAPIRegistry.registerComponent("securitySchemes", name, scheme);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return apiError(c, 500, err.message || "internal error");
  });
  for (const register of [
    registerSystem,
    registerUsers,
    registerGroups,
    registerPosts,
    registerNotifications,
    registerScheduler,
    registerSeed,
  ])
    register(app);
  return app;
}

export const feedApp = createFeedApp();
