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
  const jobId = useWorkspace((s) => s.current?.jobId);
  const opening = useWorkspace((s) => s.opening);
  const drawing = useWorkspaceMutating("draw");
  // 상태만 고른다. 진행률 응답마다 draw 버튼·탭 잠금을 다시 그리지 않는다.
  // 고른 값은 조건 앞에서 늘 읽는다. 렌더 중에 읽지 않은 query는 react-query가 쓰는 필드를 몰라
  // 다시 받을 때마다(fetchStatus가 바뀔 때마다) 다시 그린다.
  const { data: status, isError } = useJobProgress(jobId, jobStatus);
  // 작업 상태를 받지 못하면(모르는 job 등) 그리는 중으로 묶어 두지 않는다.
  if (drawing || opening || (jobId && !status && !isError)) return "pending";
  if (jobId && status && !isTerminal(status)) return "cancel";
  return "draw";
}
