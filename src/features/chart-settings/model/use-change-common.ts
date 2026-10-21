"use client";

import { useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import type { CommonProps } from "@/shared/api/types";

/**
 * 공통 속성 바꾸기. 이미 그린 차트가 있으면 바꾸는 즉시 전체를 다시 그리고 item 개별 속성은 모두 덮어쓴다.
 * 아직 그리지 않았거나 legend 설정이 달라졌으면 다음 draw에 쓰일 설정만 바꾼다.
 */
export function useChangeCommon() {
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const notify = useWorkspace((s) => s.notify);
  // 그린 차트와 같은 legend를 고른 상태에서만 바로 다시 그린다.
  const appliesToCurrent =
    current !== undefined &&
    current.spec.legend === draft.legend &&
    current.spec.rows === draft.rows;

  const apply = useMutation({
    mutationFn: (common: CommonProps) => {
      if (!current) throw new Error("no chart");
      return api.updateCommon(current.chartId, common);
    },
    onSuccess: ({ jobId }, common) => {
      if (current) replaceJob(jobId, { ...current.spec, common });
    },
    onError: (err) => notify(err.message),
  });

  const change = (common: CommonProps) => {
    updateDraft({ common });
    if (appliesToCurrent) apply.mutate(common);
  };

  return {
    common: draft.common,
    change,
    pending: apply.isPending,
    appliesToCurrent,
  };
}
