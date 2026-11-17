"use client";

import { useStore } from "zustand";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { useJob } from "@/shared/api/queries";
import type { ItemLink } from "@/shared/api/types";

/**
 * 칸에 걸린 연결 범위(범위 안 행 수와 방식). 범위가 없으면 undefined.
 * 칸 차트가 보는 draw job의 item 상태(같은 query)에서 읽는다. 연결 다시 그리기가 끝나면 그 item 상태에 반영된다.
 */
export function useItemLink(store: WorkspaceStore): ItemLink | undefined {
  const jobId = useStore(store, (s) => s.current?.jobId);
  // 칸 차트(PanelChart)와 같은 페이지 크기(1)라 같은 query를 함께 쓴다.
  const job = useJob(jobId, 0, 1);
  return job.data?.items[0]?.link;
}
