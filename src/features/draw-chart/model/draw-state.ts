"use client";

import {
  useWorkspace,
  useWorkspaceMutating,
} from "@/entities/workspace/model/workspace-scope";
import { useJobProgress } from "@/shared/api/queries";
import { isTerminal } from "@/shared/api/types";

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
  const job = useJobProgress(current?.jobId);
  // 작업 상태를 받지 못하면(모르는 job 등) 그리는 중으로 묶어 두지 않는다.
  if (drawing || opening || (current && !job.data && !job.isError))
    return "pending";
  if (current && job.data && !isTerminal(job.data.status)) return "cancel";
  return "draw";
}
