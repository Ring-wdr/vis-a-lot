// 피드 scheduler API 스키마.

import { z } from "@hono/zod-openapi";

export const SchedulerRunResponseSchema = z
  .object({
    /** 이번에 만든 D-1·당일 알림 이벤트 수 */
    dueSoon: z.number().int(),
    /** 이번에 만든 기한 초과 이벤트 수 (게시물마다 하루 1회) */
    overdue: z.number().int(),
    /** 재개일이 지나 미해결로 돌린 보류 게시물 수 */
    resumed: z.number().int(),
  })
  .openapi("SchedulerRunResponse");

export type SchedulerRunResponse = z.infer<typeof SchedulerRunResponseSchema>;
