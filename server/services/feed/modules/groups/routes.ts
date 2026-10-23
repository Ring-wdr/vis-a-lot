// 피드 groups API 정의. {groupId}는 그룹 id 또는 키 접두사(FD)를 받는다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  GroupDetailSchema,
  GroupListResponseSchema,
  SavePostTypeRequestSchema,
  SaveTeamRequestSchema,
  SetMemberRequestSchema,
  UpdateGroupRequestSchema,
} from "./schemas";

const GroupParams = z.object({ groupId: PathId("groupId") });
const errors = {
  400: errorResponse("요청 형식 오류, 키 접두사 중복 등"),
  401: errorResponse("사용자를 고르지 않음"),
  403: errorResponse("그룹 관리자만"),
  404: errorResponse("모르는 그룹(비공개 그룹은 멤버가 아니면 404)"),
};
const ok = jsonResponse(GroupDetailSchema, "바뀐 그룹");

export const listGroups = createRoute({
  method: "get",
  path: "/groups",
  tags: ["groups"],
  summary: "볼 수 있는 그룹 목록 (비공개 그룹은 멤버와 시스템 관리자만)",
  security: FEED_USER,
  responses: {
    200: jsonResponse(GroupListResponseSchema, "목록"),
    401: errors[401],
  },
});

export const getGroup = createRoute({
  method: "get",
  path: "/groups/{groupId}",
  tags: ["groups"],
  summary: "그룹 하나: 멤버, 팀, 게시물 유형",
  security: FEED_USER,
  request: { params: GroupParams },
  responses: {
    200: jsonResponse(GroupDetailSchema, "그룹"),
    401: errors[401],
    404: errors[404],
  },
});

export const updateGroup = createRoute({
  method: "patch",
  path: "/groups/{groupId}",
  tags: ["groups"],
  summary: "그룹 설정 (이름·설명·비공개·키 접두사·상태 이름)",
  security: FEED_USER,
  request: { params: GroupParams, body: jsonBody(UpdateGroupRequestSchema) },
  responses: { 200: ok, ...errors },
});

export const setGroupMember = createRoute({
  method: "put",
  path: "/groups/{groupId}/members/{userId}",
  tags: ["groups"],
  summary: "멤버 추가 또는 역할 바꾸기",
  security: FEED_USER,
  request: {
    params: GroupParams.extend({ userId: PathId("userId") }),
    body: jsonBody(SetMemberRequestSchema),
  },
  responses: { 200: ok, ...errors },
});

export const removeGroupMember = createRoute({
  method: "delete",
  path: "/groups/{groupId}/members/{userId}",
  tags: ["groups"],
  summary: "멤버 빼기. 마지막 그룹 관리자는 뺄 수 없다(400)",
  security: FEED_USER,
  request: { params: GroupParams.extend({ userId: PathId("userId") }) },
  responses: { 200: ok, ...errors },
});

export const saveGroupTeam = createRoute({
  method: "post",
  path: "/groups/{groupId}/teams",
  tags: ["groups"],
  summary: "팀 만들기(id 없음) 또는 이름 바꾸기",
  security: FEED_USER,
  request: { params: GroupParams, body: jsonBody(SaveTeamRequestSchema) },
  responses: { 200: ok, ...errors },
});

export const deleteGroupTeam = createRoute({
  method: "delete",
  path: "/groups/{groupId}/teams/{teamId}",
  tags: ["groups"],
  summary: "팀 지우기. 그 팀 게시물은 팀 없음이 된다",
  security: FEED_USER,
  request: { params: GroupParams.extend({ teamId: PathId("teamId") }) },
  responses: { 200: ok, ...errors },
});

export const saveGroupPostType = createRoute({
  method: "post",
  path: "/groups/{groupId}/post-types",
  tags: ["groups"],
  summary: "게시물 유형 만들기(id 없음) 또는 바꾸기",
  security: FEED_USER,
  request: { params: GroupParams, body: jsonBody(SavePostTypeRequestSchema) },
  responses: { 200: ok, ...errors },
});

export const deleteGroupPostType = createRoute({
  method: "delete",
  path: "/groups/{groupId}/post-types/{postTypeId}",
  tags: ["groups"],
  summary: "게시물 유형 지우기. 그 유형 게시물은 유형 없음이 된다",
  security: FEED_USER,
  request: {
    params: GroupParams.extend({ postTypeId: PathId("postTypeId") }),
  },
  responses: { 200: ok, ...errors },
});
