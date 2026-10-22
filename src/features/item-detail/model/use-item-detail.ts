"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
 * 그리는 동안에는 같은 item의 직전 크게 보기 PNG를 늘려 보여준다.
 * 그것도 없을 때만(처음 열 때) grid PNG를 늘려 보여주도록 화면에 맡긴다.
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
  const failure = state?.error;

  useEffect(() => {
    if (failed) notify(failure ?? "크게 보기 PNG를 그리지 못했습니다.");
  }, [failed, failure, notify]);

  const image =
    query.data && "image" in query.data
      ? query.data.image
      : state?.status === "success"
        ? state.image
        : undefined;
  // 도형·색 변경으로 revision이 바뀌거나 크기가 바뀌면 query key가 바뀌어 image가 잠시 없다.
  // 그동안 작은 grid PNG로 돌아가면 줄었다 커지는 것처럼 보이므로 마지막 PNG를 붙잡아 둔다.
  const [last, setLast] = useState<{ key: string; image: ChartImage }>();
  if (
    image &&
    item &&
    (last?.image.url !== image.url || last.key !== item.key)
  ) {
    setLast({ key: item.key, image });
  }
  const previous = last && last.key === item?.key ? last.image : undefined;

  if (image) return { image };
  // 끝났는데 그림이 없으면(실패, 내용이 바뀌어 버림) 기다리지 않는다.
  if (state && isTerminal(state.status)) return { image: previous };
  return {
    image: previous,
    rendering: jobId && item ? (state ?? queued(item)) : undefined,
  };
}

const queued = (item: ItemState): ItemState => ({ ...item, status: "queued" });
