// 피드 reports API 정의. 그룹을 볼 수 있는 사람이면 누구나 본다.

import { createRoute, z } from "@hono/zod-openapi";
import { errorResponse, jsonBody, jsonResponse } from "../../../common/http";
import { FEED_USER } from "../../security";
import { PathId } from "../common";
import {
  ActivityReportRequestSchema,
  ActivityReportSchema,
  ReportTemplateListQuerySchema,
  ReportTemplateListResponseSchema,
  ReportTemplateSchema,
  SaveReportTemplateRequestSchema,
  StatusReportRequestSchema,
  StatusReportSchema,
} from "./schemas";

const errors = {
  400: errorResponse("요청 형식 오류 (from > to, 기간이 1년 넘음 등)"),
  401: errorResponse("사용자를 고르지 않음"),
  403: errorResponse("권한 없음"),
  404: errorResponse("모르는 그룹·템플릿"),
};

export const activityReport = createRoute({
  method: "post",
  path: "/reports/activity",
  tags: ["reports"],
  summary:
    "활동 보고: 기간·팀·담당자 → 날짜순 활동 로그, 해결·생성한 게시물, 사람별 수",
  security: FEED_USER,
  request: { body: jsonBody(ActivityReportRequestSchema) },
  responses: { 200: jsonResponse(ActivityReportSchema, "보고"), ...errors },
});

export const statusReport = createRoute({
  method: "post",
  path: "/reports/status",
  tags: ["reports"],
  summary:
    "현황 보고: 상태별 수, 기한 초과, 담당자별 부하, 검토 대기 체류, 최근 30일 리드타임, 열린 게시물 목록",
  security: FEED_USER,
  request: { body: jsonBody(StatusReportRequestSchema) },
  responses: { 200: jsonResponse(StatusReportSchema, "보고"), ...errors },
});

export const listReportTemplates = createRoute({
  method: "get",
  path: "/reports/templates",
  tags: ["reports"],
  summary: "그룹의 보고 템플릿",
  security: FEED_USER,
  request: { query: ReportTemplateListQuerySchema },
  responses: {
    200: jsonResponse(ReportTemplateListResponseSchema, "목록"),
    ...errors,
  },
});

export const saveReportTemplate = createRoute({
  method: "post",
  path: "/reports/templates",
  tags: ["reports"],
  summary:
    "템플릿 저장 (id가 없으면 새로. 그룹 멤버가 만들고, 고치기는 만든 사람·그룹 관리자)",
  security: FEED_USER,
  request: { body: jsonBody(SaveReportTemplateRequestSchema) },
  responses: {
    200: jsonResponse(ReportTemplateSchema, "저장한 템플릿"),
    ...errors,
  },
});

export const deleteReportTemplate = createRoute({
  method: "delete",
  path: "/reports/templates/{templateId}",
  tags: ["reports"],
  summary: "템플릿 지우기",
  security: FEED_USER,
  request: { params: z.object({ templateId: PathId("templateId") }) },
  responses: { 204: { description: "지움" }, ...errors },
});
