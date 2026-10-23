// 피드 users API 정의. 프로토타입은 로그인 대신 사용자 목록에서 골라 x-feed-user로 보낸다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  DeactivateResponseSchema,
  FeedUserSchema,
  FollowRequestSchema,
  FollowResponseSchema,
  MeSchema,
  SetAdminRequestSchema,
  UserListResponseSchema,
} from "./schemas";

const UserParams = z.object({ userId: PathId("userId") });
const noActor = { 401: errorResponse("사용자를 고르지 않음") };
const adminOnly = { 403: errorResponse("시스템 관리자만") };
const unknownUser = { 404: errorResponse("모르는 사용자") };

export const listUsers = createRoute({
  method: "get",
  path: "/users",
  tags: ["users"],
  summary: "사용자 목록 (사용자 전환, 담당자 고르기). 비활성 사용자 포함",
  responses: { 200: jsonResponse(UserListResponseSchema, "목록") },
});

export const getMe = createRoute({
  method: "get",
  path: "/users/me",
  tags: ["users"],
  summary: "지금 사용자",
  security: FEED_USER,
  responses: { 200: jsonResponse(MeSchema, "지금 사용자"), ...noActor },
});

export const setUserAdmin = createRoute({
  method: "put",
  path: "/users/{userId}/admin",
  tags: ["users"],
  summary: "시스템 관리자 지정·해제",
  security: FEED_USER,
  request: { params: UserParams, body: jsonBody(SetAdminRequestSchema) },
  responses: {
    200: jsonResponse(FeedUserSchema, "바뀐 사용자"),
    ...noActor,
    ...adminOnly,
    ...unknownUser,
  },
});

export const deactivateUser = createRoute({
  method: "post",
  path: "/users/{userId}/deactivate",
  tags: ["users"],
  summary:
    "사용자 비활성화. 담당·요청 중인 열린 게시물을 돌려줘 재배정을 안내한다",
  security: FEED_USER,
  request: { params: UserParams },
  responses: {
    200: jsonResponse(DeactivateResponseSchema, "비활성화한 사용자"),
    ...noActor,
    ...adminOnly,
    ...unknownUser,
  },
});

export const followUser = createRoute({
  method: "put",
  path: "/users/{userId}/follow",
  tags: ["users"],
  summary: "관심(팔로우) 켜기·끄기",
  security: FEED_USER,
  request: { params: UserParams, body: jsonBody(FollowRequestSchema) },
  responses: {
    200: jsonResponse(FollowResponseSchema, "지금 상태"),
    ...noActor,
    ...unknownUser,
  },
});
