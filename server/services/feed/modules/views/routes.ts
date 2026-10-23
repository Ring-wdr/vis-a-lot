// 피드 views API 정의. 기본 제공 뷰(탐색·관심)도 같은 목록에 섞여 온다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  PinViewRequestSchema,
  SavedViewSchema,
  SaveViewRequestSchema,
  ViewListQuerySchema,
  ViewListResponseSchema,
} from "./schemas";

const ViewParams = z.object({ viewId: PathId("viewId") });
const errors = {
  400: errorResponse("요청 형식 오류 (공유 뷰에 그룹 없음 등)"),
  401: errorResponse("사용자를 고르지 않음"),
  403: errorResponse("내 뷰가 아니거나 그룹 관리자가 아님, 기본 제공 뷰"),
  404: errorResponse("모르는 뷰 (볼 수 없는 뷰 포함)"),
};

export const listViews = createRoute({
  method: "get",
  path: "/views",
  tags: ["views"],
  summary:
    "볼 수 있는 뷰: 기본 제공 뷰 + 내 뷰 + 볼 수 있는 그룹의 공유 뷰. groupId가 있으면 그 그룹 것(과 그룹 없는 내 뷰)만",
  security: FEED_USER,
  request: { query: ViewListQuerySchema },
  responses: {
    200: jsonResponse(ViewListResponseSchema, "목록"),
    401: errors[401],
  },
});

export const getView = createRoute({
  method: "get",
  path: "/views/{viewId}",
  tags: ["views"],
  summary: "뷰 하나",
  security: FEED_USER,
  request: { params: ViewParams },
  responses: {
    200: jsonResponse(SavedViewSchema, "뷰"),
    401: errors[401],
    404: errors[404],
  },
});

export const saveView = createRoute({
  method: "post",
  path: "/views",
  tags: ["views"],
  summary:
    "뷰 저장 (id가 없으면 새로). 공유 뷰는 그 그룹 멤버가 만들고, 고치기는 만든 사람·그룹 관리자",
  security: FEED_USER,
  request: { body: jsonBody(SaveViewRequestSchema) },
  responses: { 200: jsonResponse(SavedViewSchema, "저장한 뷰"), ...errors },
});

export const deleteView = createRoute({
  method: "delete",
  path: "/views/{viewId}",
  tags: ["views"],
  summary: "뷰 지우기",
  security: FEED_USER,
  request: { params: ViewParams },
  responses: { 204: { description: "지움" }, ...errors },
});

export const pinView = createRoute({
  method: "put",
  path: "/views/{viewId}/pin",
  tags: ["views"],
  summary: "사이드바 고정 켜기·끄기 (고칠 수 있는 뷰만)",
  security: FEED_USER,
  request: { params: ViewParams, body: jsonBody(PinViewRequestSchema) },
  responses: { 200: jsonResponse(SavedViewSchema, "바뀐 뷰"), ...errors },
});
