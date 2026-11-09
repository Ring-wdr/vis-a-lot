"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import {
  type ItemSize,
  isTerminal,
  type JobStateResponse,
} from "@/shared/api/types";
import { useDebounced } from "@/shared/lib/use-debounced";

const RESIZE_DEBOUNCE_MS = 300;
const RETRY_MS = 1000;
const RETRY_COUNT = 2;

type ResizeRequest = {
  chartId: string;
  size: ItemSize;
  keys: string[];
};

/** 크기·배율·테마를 한 문자열로 묶는다. debounce한 값이 바뀔 때만 다시 확인한다. */
function lookKey(size: ItemSize) {
  return [
    size.width,
    size.height,
    size.pixelRatio ?? 1,
    size.theme ?? "light",
  ].join("|");
}

/**
 * 화면 크기가 바뀌면 크기 변경이 멈추고 300ms 뒤에, 현재 페이지에서 PNG 크기가 칸과 다른 item만 다시 그린다.
 * 화면 배율·테마가 바뀐 것도 같은 규칙으로 다시 그린다 (PNG가 그 배율·테마로 그려져 있지 않으면 다른 크기로 본다).
 * - draw job이 진행 중이면 끝날 때까지 기다렸다가 크기가 다른 item만 다시 그린다.
 * - 다른 페이지는 이동해서 그 페이지가 보일 때 같은 규칙으로 다시 그린다.
 */
export function useAutoResize(
  chartId: string | undefined,
  /** 현재 페이지 item 상태 */
  job: JobStateResponse | undefined,
  /** job 전체 상태 (페이지 polling은 먼저 멈출 수 있다) */
  jobStatus: JobStateResponse["status"] | undefined,
  desired: ItemSize | undefined,
) {
  const itemJobs = useWorkspace((s) => s.itemJobs);
  const setItemJob = useWorkspace((s) => s.setItemJob);
  const sizeKey = useDebounced(
    desired ? lookKey(desired) : "",
    RESIZE_DEBOUNCE_MS,
  );
  const { mutate: resize, isPending } = useMutation({
    mutationFn: ({ chartId, size, keys }: ResizeRequest) =>
      api.resizeItems(chartId, size, keys),
    onSuccess: ({ jobId }, { keys }) => {
      for (const key of keys) setItemJob(key, jobId);
    },
    // 실패하면 잠시 뒤 같은 요청을 몇 번 더 보낸다. 그래도 실패하면 요청이 끝나 아래 effect가 다시 확인한다.
    retry: (count, err) => {
      console.warn("resize 요청 실패, 다시 시도합니다", err);
      return count < RETRY_COUNT;
    },
    retryDelay: RETRY_MS,
  });

  useEffect(() => {
    if (!chartId || !job || !sizeKey || !jobStatus || !isTerminal(jobStatus))
      return;
    if (isPending) return;
    const [w, h, ratio, theme] = sizeKey.split("|");
    const [width, height, pixelRatio] = [w, h, ratio].map(Number);
    // 다시 그리는 중인 item은 빼고, 끝나면(itemJobs가 바뀌면) 다시 확인한다.
    const stale = job.items.filter(
      (i) =>
        i.status === "success" &&
        i.image &&
        !itemJobs[i.key] &&
        lookKey(i.image) !== sizeKey,
    );
    if (stale.length === 0) return;
    resize({
      chartId,
      size: {
        width,
        height,
        ...(pixelRatio > 1 ? { pixelRatio } : {}),
        ...(theme === "dark" ? { theme } : {}),
      },
      keys: stale.map((i) => i.key),
    });
  }, [chartId, job, jobStatus, sizeKey, itemJobs, isPending, resize]);
}
