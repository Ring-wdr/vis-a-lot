// 피드 system API 정의: 화면이 처음 뜰 때 시드를 넣고, /feed/dev 장치가 리셋·시계를 바꾼다.

import { createRoute } from "@hono/zod-openapi";
import { jsonBody, jsonResponse } from "../../../common/http";
import {
  FeedClockRequestSchema,
  FeedClockSchema,
  FeedStatusSchema,
} from "./schemas";

export const getSystemStatus = createRoute({
  method: "get",
  path: "/system/status",
  tags: ["system"],
  summary: "피드 DB의 사용자·게시물 수",
  responses: { 200: jsonResponse(FeedStatusSchema, "상태") },
});

export const bootstrapSystem = createRoute({
  method: "post",
  path: "/system/bootstrap",
  tags: ["system"],
  summary: "비어 있으면 기본 시나리오를 적재한다. 화면이 처음 뜰 때 부른다",
  responses: { 200: jsonResponse(FeedStatusSchema, "적재 뒤 상태") },
});

export const resetSystem = createRoute({
  method: "post",
  path: "/system/reset",
  tags: ["system"],
  summary:
    "피드 스키마를 지우고 기본 시나리오를 다시 적재한다 (/feed/dev/seed)",
  responses: { 200: jsonResponse(FeedStatusSchema, "적재 뒤 상태") },
});

export const getSystemClock = createRoute({
  method: "get",
  path: "/system/clock",
  tags: ["system"],
  summary: "시계 오프셋과 피드의 지금",
  responses: { 200: jsonResponse(FeedClockSchema, "시계") },
});

export const setSystemClock = createRoute({
  method: "put",
  path: "/system/clock",
  tags: ["system"],
  summary: "시계 오프셋 바꾸기 (/feed/dev/clock). 0이면 실제 시각",
  request: { body: jsonBody(FeedClockRequestSchema) },
  responses: { 200: jsonResponse(FeedClockSchema, "바꾼 시계") },
});
