"use client";

// 보고 서버 상태. 보고는 게시물에서 계산하므로 key를 ['feed', 'posts', ...] 아래에 두어
// 게시물을 바꾸면(invalidatePosts) 함께 다시 받는다. 템플릿은 따로 둔다.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ActivityReportRequest,
  reportsApi,
  type SaveReportTemplateRequest,
  type StatusReportRequest,
} from "./reports";

export const reportKeys = {
  activity: (req: ActivityReportRequest) =>
    ["feed", "posts", "reports", "activity", req] as const,
  status: (req: StatusReportRequest) =>
    ["feed", "posts", "reports", "status", req] as const,
  templates: (groupId: string) =>
    ["feed", "report-templates", groupId] as const,
};

/** 활동 보고. 조건을 바꾸는 동안 이전 결과를 보여준다 */
export const useActivityReport = (
  req: ActivityReportRequest | null,
  enabled = true,
) =>
  useQuery({
    queryKey: reportKeys.activity(req ?? { groupId: "", from: "", to: "" }),
    queryFn: () => reportsApi.activity(req as ActivityReportRequest),
    placeholderData: keepPreviousData,
    enabled: enabled && !!req,
  });

export const useStatusReport = (req: StatusReportRequest | null) =>
  useQuery({
    queryKey: reportKeys.status(req ?? { groupId: "" }),
    queryFn: () => reportsApi.status(req as StatusReportRequest),
    placeholderData: keepPreviousData,
    enabled: !!req,
  });

export const useReportTemplates = (groupId: string | undefined) =>
  useQuery({
    queryKey: reportKeys.templates(groupId ?? ""),
    queryFn: () => reportsApi.templates(groupId ?? ""),
    select: (r) => r.templates,
    enabled: !!groupId,
  });

export function useSaveReportTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveReportTemplateRequest) =>
      reportsApi.saveTemplate(body),
    onSuccess: (t) =>
      client.invalidateQueries({ queryKey: reportKeys.templates(t.groupId) }),
  });
}

export function useDeleteReportTemplate(groupId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => reportsApi.removeTemplate(templateId),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: reportKeys.templates(groupId ?? ""),
      }),
  });
}
