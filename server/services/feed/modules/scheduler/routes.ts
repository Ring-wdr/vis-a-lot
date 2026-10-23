// 피드 scheduler API 정의. 화면이 앱 시작 시와 1분 간격으로 부른다 (프로토타입에 백그라운드 서버가 없어서).

import { createRoute } from "@hono/zod-openapi";
import { jsonResponse } from "../../../common/http";
import { SchedulerRunResponseSchema } from "./schemas";

export const runScheduler = createRoute({
  method: "post",
  path: "/scheduler/run",
  tags: ["scheduler"],
  summary:
    "기한 알림(D-1·당일·초과, 게시물마다 하루 1회)과 보류 자동 복귀. 같은 날 여러 번 불러도 한 번만 만든다",
  responses: { 200: jsonResponse(SchedulerRunResponseSchema, "이번에 한 일") },
});
