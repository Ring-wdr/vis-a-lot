"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useWorkspace,
  useWorkspaceMutating,
  useWorkspaceMutationKey,
} from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { useJobProgress } from "@/shared/api/queries";
import { type CommonProps, isTerminal } from "@/shared/api/types";
import { useDebounced } from "@/shared/lib/use-debounced";

/** 공통 속성을 이만큼 바꾸지 않아야 보낸다. 연달아 바꾸면 마지막 값만 한 번 보낸다. */
export const COMMON_SEND_DELAY_MS = 500;

/** 그린 차트와 같은 legend·데이터를 고른 상태에서만 바로 다시 그린다. */
function useAppliesToCurrent() {
  return useWorkspace(
    (s) =>
      s.current !== undefined &&
      s.current.spec.legend === s.draft.legend &&
      s.current.spec.dataset === s.draft.dataset,
  );
}

/**
 * 공통 속성 바꾸기. 바로 다음 draw 설정(draft)에 넣고, 이미 그린 차트에 적용할 수 있으면 보낼 값으로 표시한다.
 * 실제로 보내는 일은 useCommonSync가 한 곳에서 묶어서 한다.
 */
export function useChangeCommon() {
  const common = useWorkspace((s) => s.draft.common);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const setCommonDirty = useWorkspace((s) => s.setCommonDirty);
  const dirty = useWorkspace((s) => s.commonDirty);
  const sending = useWorkspaceMutating("common");
  const appliesToCurrent = useAppliesToCurrent();

  const change = (next: CommonProps) => {
    updateDraft({ common: next });
    if (appliesToCurrent) setCommonDirty(true);
  };

  return {
    common,
    change,
    /** 보낼 값이 남았거나 보내는 중 */
    pending: dirty || sending,
    appliesToCurrent,
  };
}

/**
 * 바꾼 공통 속성을 서버에 보낸다. 작업 화면에 하나만 둔다.
 * - 마지막 변경 뒤 COMMON_SEND_DELAY_MS 동안 더 바꾸지 않으면 그때의 공통 속성을 한 번 보낸다.
 * - 그리는 중(draw, 공통 속성 다시 그리기, item 다시 그리기)이면 끝날 때까지 기다렸다가 마지막 값을 보낸다.
 * - 보고 있는 페이지만 바로 다시 그리고, 나머지 item은 그 페이지를 볼 때 다시 그린다.
 */
export function useCommonSync() {
  const current = useWorkspace((s) => s.current);
  const common = useWorkspace((s) => s.draft.common);
  const dirty = useWorkspace((s) => s.commonDirty);
  const setCommonDirty = useWorkspace((s) => s.setCommonDirty);
  const page = useWorkspace((s) => s.page);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const notify = useWorkspace((s) => s.notify);
  const updateOptionsItem = useWorkspace((s) => s.updateOptionsItem);
  const redrawing = useWorkspace((s) => Object.keys(s.itemJobs).length > 0);
  // 그리는 중이면(draw job 또는 공통 속성 다시 그리기) 서버가 거절하므로 끝날 때까지 기다린다.
  const job = useJobProgress(current?.jobId);
  const drawing = job.data !== undefined && !isTerminal(job.data.status);
  const appliesToCurrent = useAppliesToCurrent();
  const settled = useDebounced(common, COMMON_SEND_DELAY_MS) === common;

  const apply = useMutation({
    mutationKey: useWorkspaceMutationKey("common"),
    mutationFn: ({
      chartId,
      next,
      visible,
    }: {
      chartId: string;
      next: CommonProps;
      visible: { start: number; count: number };
    }) => api.updateCommon(chartId, next, visible),
    onSuccess: ({ jobId }, { next }) => {
      if (current) replaceJob(jobId, { ...current.spec, common: next });
      // 공통 속성은 item별 속성을 모두 덮어쓴다. 패널이 들고 있는 item 속성도 비운다.
      updateOptionsItem({ options: undefined, dirty: false });
    },
    onError: (err) => notify(err.message),
  });

  const blocked = apply.isPending || drawing || redrawing;

  useEffect(() => {
    if (!dirty || !settled || blocked) return;
    setCommonDirty(false);
    // 그사이 legend·데이터를 바꿨으면 그린 차트에는 적용하지 않는다 (다음 draw에 쓰인다).
    if (!current || !appliesToCurrent) return;
    const pageSize = current.spec.grid.rows * current.spec.grid.cols;
    apply.mutate({
      chartId: current.chartId,
      next: common,
      visible: { start: page * pageSize, count: pageSize },
    });
  }, [
    dirty,
    settled,
    blocked,
    current,
    appliesToCurrent,
    common,
    page,
    setCommonDirty,
    apply.mutate,
  ]);
}
