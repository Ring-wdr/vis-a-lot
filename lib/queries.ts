"use client";

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isTerminal, type JobStateResponse } from "@/server/api/types";
import type { ColumnName, RowSize } from "@/server/data/schema";
import { api } from "./api";

export const queryKeys = {
  health: ["health"] as const,
  datasets: ["datasets"] as const,
  columns: (rows: RowSize) => ["datasets", rows, "columns"] as const,
  job: (jobId: string, page: number, pageSize: number) =>
    ["jobs", jobId, page, pageSize] as const,
  jobProgress: (jobId: string) => ["jobs", jobId, "progress"] as const,
  jobItem: (jobId: string, key: string) =>
    ["jobs", jobId, "item", key] as const,
};

const datasetsQuery = queryOptions({
  queryKey: queryKeys.datasets,
  queryFn: api.datasets,
  // 생성 중인 데이터셋이 있으면 진행률을 계속 받아온다.
  refetchInterval: (query) =>
    query.state.data?.datasets.some((d) => d.state === "generating")
      ? 300
      : false,
});

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: api.health });
}

export function useDatasets() {
  return useQuery(datasetsQuery);
}

export function useDatasetStatus(rows: RowSize) {
  return useQuery({
    ...datasetsQuery,
    select: (data) => data.datasets.find((d) => d.rows === rows),
  });
}

export function useGenerateDataset() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.generateDataset,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.datasets }),
  });
}

export function useColumns(rows: RowSize, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.columns(rows),
    queryFn: () => api.columns(rows),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** job이 끝났거나 현재 페이지 item이 모두 끝난 상태면 더 기다릴 게 없다. */
export function isPageSettled(job: JobStateResponse | undefined) {
  if (!job) return false;
  if (isTerminal(job.status)) return true;
  return (
    job.totalItems !== null && job.items.every((i) => isTerminal(i.status))
  );
}

/**
 * job 진행 상태를 long polling으로 받는다.
 * 응답이 오면 바로 다음 요청을 보내고, 페이지가 모두 끝난 상태가 되면 멈춘다.
 */
export function useJob(
  jobId: string | undefined,
  page: number,
  pageSize: number,
) {
  const client = useQueryClient();
  const queryKey = queryKeys.job(jobId ?? "", page, pageSize);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const prev = client.getQueryData<JobStateResponse>(queryKey);
      return api.job(
        jobId as string,
        page,
        pageSize,
        prev?.version ?? -1,
        signal,
      );
    },
    enabled: jobId !== undefined,
    refetchInterval: (query) => (isPageSettled(query.state.data) ? false : 1),
    refetchIntervalInBackground: true,
  });
}

/**
 * job 전체 진행 상태(상태, 단계, 하단 진행률)를 long polling으로 받는다.
 * 페이지 long polling은 그 페이지가 끝나면 멈추므로, job이 끝났는지는 이 요청으로 안다.
 */
export function useJobProgress(jobId: string | undefined) {
  const client = useQueryClient();
  const queryKey = queryKeys.jobProgress(jobId ?? "");
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const prev = client.getQueryData<JobStateResponse>(queryKey);
      return api.job(jobId as string, 0, 0, prev?.version ?? -1, signal);
    },
    enabled: jobId !== undefined,
    refetchInterval: (query) =>
      query.state.data && isTerminal(query.state.data.status) ? false : 1,
    refetchIntervalInBackground: true,
  });
}

/** item 단위 다시 그리기에서 그 item 하나의 상태. 그 item이 끝나면 polling을 멈춘다. */
export function useJobItem(jobId: string | undefined, key: string) {
  const client = useQueryClient();
  const queryKey = queryKeys.jobItem(jobId ?? "", key);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const prev = client.getQueryData<JobStateResponse>(queryKey);
      return api.jobItems(jobId as string, [key], prev?.version ?? -1, signal);
    },
    enabled: jobId !== undefined,
    refetchInterval: (query) => (isPageSettled(query.state.data) ? false : 1),
    refetchIntervalInBackground: true,
  });
}

export function useCancelJob() {
  return useMutation({ mutationFn: api.cancelJob });
}

/** item에 처음 커서를 올릴 때 받아 오고, 같은 PNG 버전이면 다시 받지 않는다. */
export function useItemMeta(pngUrl: string, enabled: boolean) {
  return useQuery({
    queryKey: ["meta", pngUrl],
    queryFn: () => api.itemMeta(pngUrl),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
  });
}

/** x, y 외의 툴팁 컬럼. 고른 컬럼이 있고 가리킨 행이 있을 때만 서버에 묻는다. */
export function useTooltipValues(
  chartId: string,
  itemKey: string,
  rowId: number | undefined,
  columns: ColumnName[],
) {
  return useQuery({
    queryKey: ["tooltip", chartId, itemKey, rowId, columns],
    queryFn: () =>
      api.tooltip(chartId, itemKey, { rowId: rowId as number, columns }),
    enabled: rowId !== undefined && columns.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
