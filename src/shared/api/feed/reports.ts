// 피드 reports API: 활동 보고, 현황 보고, 보고 템플릿.

import type { components } from "@/shared/api/generated/feed";
import { feedClient, unwrap } from "./client";

type Feed = components["schemas"];

export type ActivityReportRequest = Feed["ActivityReportRequest"];
export type ActivityReport = Feed["ActivityReport"];
export type ActivityEntry = Feed["ActivityEntry"];
export type StatusReportRequest = Feed["StatusReportRequest"];
export type StatusReport = Feed["StatusReport"];
export type ReportTemplate = Feed["ReportTemplate"];
export type ReportTemplateParams = Feed["ReportTemplateParams"];
export type SaveReportTemplateRequest = Feed["SaveReportTemplateRequest"];

export const reportsApi = {
  activity: (body: ActivityReportRequest) =>
    unwrap(feedClient.POST("/reports/activity", { body })),
  status: (body: StatusReportRequest) =>
    unwrap(feedClient.POST("/reports/status", { body })),
  templates: (groupId: string) =>
    unwrap(
      feedClient.GET("/reports/templates", { params: { query: { groupId } } }),
    ),
  saveTemplate: (body: SaveReportTemplateRequest) =>
    unwrap(feedClient.POST("/reports/templates", { body })),
  removeTemplate: (templateId: string) =>
    unwrap(
      feedClient.DELETE("/reports/templates/{templateId}", {
        params: { path: { templateId } },
      }),
    ),
};
