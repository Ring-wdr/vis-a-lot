// 피드 users API 스키마.

import { z } from "@hono/zod-openapi";
import { PostRefSchema } from "../common";

export const FeedUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    /** 시스템 관리자 */
    isAdmin: z.boolean(),
    active: z.boolean(),
  })
  .openapi("FeedUser");

export const UserListResponseSchema = z
  .object({ users: z.array(FeedUserSchema) })
  .openapi("UserListResponse");

export const MeSchema = FeedUserSchema.extend({
  /** 관심(팔로우)한 사용자 id */
  following: z.array(z.string()),
}).openapi("Me");

export const SetAdminRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("SetAdminRequest");

export const DeactivateResponseSchema = z
  .object({
    user: FeedUserSchema,
    /** 이 사용자가 담당·요청 중인 열린 게시물. 재배정 안내에 쓴다 */
    openPosts: z.array(PostRefSchema),
  })
  .openapi("DeactivateResponse");

export const FollowRequestSchema = z
  .object({ on: z.boolean() })
  .openapi("FollowRequest");

export const FollowResponseSchema = z
  .object({ following: z.boolean() })
  .openapi("FollowResponse");

export type FeedUser = z.infer<typeof FeedUserSchema>;
export type Me = z.infer<typeof MeSchema>;
export type DeactivateResponse = z.infer<typeof DeactivateResponseSchema>;
