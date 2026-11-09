// 피드 system API 스키마: DB 상태, 부트스트랩, 리셋, 시계.

import { z } from "@hono/zod-openapi";

export const FeedStatusSchema = z
  .object({ users: z.number(), posts: z.number() })
  .openapi("FeedStatus");

export const FeedClockSchema = z
  .object({
    /** 실제 시각에 더하는 오프셋(ms) */
    offsetMs: z.number(),
    /** 오프셋이 반영된 지금 (ISO) */
    now: z.string(),
  })
  .openapi("FeedClock");

export const FeedClockRequestSchema = z
  .object({ offsetMs: z.number().int() })
  .openapi("FeedClockRequest");
