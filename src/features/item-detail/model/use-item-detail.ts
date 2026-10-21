"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { useJobItem } from "@/shared/api/queries";
import {
  type ChartImage,
  type ItemSize,
  type ItemState,
  isTerminal,
} from "@/shared/api/types";

/**
 * 크게 보기용 PNG. 서버가 같은 내용(revision)·같은 크기로 그려 둔 게 있으면 바로 받고,
 * 없으면 그 한 장만 그리는 job을 long polling으로 기다린다.
 * 그리는 동안(image 없음)에는 grid PNG를 늘려 보여주도록 화면에 맡긴다.
 */
export function useItemDetail(
  chartId: string,
  item: ItemState | undefined,
  size: ItemSize | undefined,
  /** item 조작으로 다시 그리는 중이면 끝난 뒤 새 revision으로 받는다. */
  enabled: boolean,
): { image?: ChartImage; rendering?: ItemState } {
  const notify = useWorkspace((s) => s.notify);
  const query = useQuery({
    queryKey: [
      "detail",
      chartId,
      item?.key,
      item?.revision,
      size?.width,
      size?.height,
    ],
    queryFn: () =>
      api.itemDetail(chartId, (item as ItemState).key, size as ItemSize),
    enabled: enabled && item?.status === "success" && size !== undefined,
    // 서버 캐시에서 밀려났을 수 있어 다시 열 때 한 번 더 묻는다. 남아 있으면 그리지 않고 바로 온다.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const jobId =
    query.data && "jobId" in query.data ? query.data.jobId : undefined;
  const job = useJobItem(jobId, item?.key ?? "");
  const state = job.data?.items[0];
  const failed = state?.status === "failed";

  useEffect(() => {
    if (failed) notify("크게 보기 PNG를 그리지 못했습니다.");
  }, [failed, notify]);

  if (query.data && "image" in query.data) return { image: query.data.image };
  if (state?.status === "success") return { image: state.image };
  // 끝났는데 그림이 없으면(실패, 내용이 바뀌어 버림) 기다리지 않는다.
  if (state && isTerminal(state.status)) return {};
  return { rendering: jobId && item ? (state ?? queued(item)) : undefined };
}

const queued = (item: ItemState): ItemState => ({ ...item, status: "queued" });
