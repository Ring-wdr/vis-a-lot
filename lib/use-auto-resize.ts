"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ItemSize,
  isTerminal,
  type JobStateResponse,
} from "@/server/api/types";
import { api } from "./api";
import { useDebounced } from "./use-debounced";
import { useWorkspace } from "./workspace-store";

const RESIZE_DEBOUNCE_MS = 300;
const RETRY_MS = 1000;

/**
 * 화면 크기가 바뀌면 크기 변경이 멈추고 300ms 뒤에, 현재 페이지에서 PNG 크기가 칸과 다른 item만 다시 그린다.
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
    desired ? `${desired.width}x${desired.height}` : "",
    RESIZE_DEBOUNCE_MS,
  );
  const inFlight = useRef(false);
  // 요청이 실패하면 잠시 뒤 다시 확인하도록 effect를 깨운다.
  const [retryTick, setRetryTick] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryTick은 실패한 요청을 다시 확인하게 하는 트리거다.
  useEffect(() => {
    if (!chartId || !job || !sizeKey || !jobStatus || !isTerminal(jobStatus))
      return;
    if (inFlight.current) return;
    const [width, height] = sizeKey.split("x").map(Number);
    // 다시 그리는 중인 item은 빼고, 끝나면(itemJobs가 바뀌면) 다시 확인한다.
    const stale = job.items.filter(
      (i) =>
        i.status === "success" &&
        i.image &&
        !itemJobs[i.key] &&
        (i.image.width !== width || i.image.height !== height),
    );
    if (stale.length === 0) return;
    const keys = stale.map((i) => i.key);
    inFlight.current = true;
    api
      .resizeItems(chartId, { width, height }, keys)
      .then(({ jobId }) => {
        for (const key of keys) setItemJob(key, jobId);
      })
      .catch((err: unknown) => {
        console.warn("resize 요청 실패, 다시 시도합니다", err);
        setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [chartId, job, jobStatus, sizeKey, itemJobs, setItemJob, retryTick]);
}
