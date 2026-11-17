"use client";

import { useSyncExternalStore } from "react";
import { useBoard } from "@/entities/workspace/model/board-scope";
import { useJobProgress } from "@/shared/api/queries";
import type { JobStateResponse } from "@/shared/api/types";

const noop = () => () => {};

/** draw job이 실패했는지 (칸이 item 하나라 item 실패도 칸 실패다). 하단 줄의 실패 수와 같은 기준이다. */
const jobFailed = (job: JobStateResponse) =>
  job.status === "failed" || job.counts.failed > 0;

/**
 * 이 칸이 따르는 칸의 마지막 draw가 실패했는지. 그러면 따를 칸에 선택이 없어 서버가 범위를 푼다.
 * 따를 칸의 draw job 상태는 그 칸 차트가 보는 것과 같은 query를 함께 쓴다.
 */
export function useFollowFailed(panelId: string) {
  const source = useBoard((s) => {
    const follow = s.links[panelId]?.follow;
    return follow ? s.panels[follow] : undefined;
  });
  const jobId = useSyncExternalStore(
    source?.subscribe ?? noop,
    () => source?.getState().current?.jobId,
    () => undefined,
  );
  return useJobProgress(jobId, jobFailed).data === true;
}
