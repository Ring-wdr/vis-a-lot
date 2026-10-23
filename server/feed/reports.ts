// 피드 reports 모듈: 활동 보고(무슨 일이 있었나), 현황 보고(지금 어디에 있나), 보고 템플릿.
// 계산은 reports/activity.ts·reports/status.ts, 템플릿 권한은 reports/templates.ts.

import { defineOps } from "./context";
import { activityReport } from "./reports/activity";
import { statusReport } from "./reports/status";
import {
  deleteTemplate,
  listTemplates,
  saveTemplate,
} from "./reports/templates";

export const reportsOps = defineOps({
  "reports.activity": activityReport,
  "reports.status": statusReport,
  "reports.templates.list": listTemplates,
  "reports.templates.save": saveTemplate,
  "reports.templates.delete": deleteTemplate,
});
