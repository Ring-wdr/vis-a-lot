"use client";

import {
  useWorkspace,
  useWorkspaceMutating,
} from "@/entities/workspace/model/workspace-scope";
import { useJobProgress } from "@/shared/api/queries";
import { isTerminal, type JobStateResponse } from "@/shared/api/types";

const jobStatus = (job: JobStateResponse) => job.status;

/** draw 버튼 상태. draw가 아니면 그리는 중이다. */
export type DrawState = "draw" | "pending" | "cancel";

/**
 * 이 탭의 draw 진행 상태: draw → pending(요청 중, 작업 상태를 아직 못 받음) → cancel(그리는 중) → draw.
 * 탭을 오가 다시 마운트돼도 이어지도록 mutation은 key로, 작업은 서버 상태로 판단한다.
 */
export function useDrawState(): DrawState {
  const current = useWorkspace((s) => s.current);
  const opening = useWorkspace((s) => s.opening);
  const drawing = useWorkspaceMutating("draw");
  // 상태만 고른다. 진행률 응답마다 draw 버튼·탭 잠금을 다시 그리지 않는다.
  const job = useJobProgress(current?.jobId, jobStatus);
  // 작업 상태를 받지 못하면(모르는 job 등) 그리는 중으로 묶어 두지 않는다.
  if (drawing || opening || (current && !job.data && !job.isError))
    return "pending";
  if (current && job.data && !isTerminal(job.data)) return "cancel";
  return "draw";
}
