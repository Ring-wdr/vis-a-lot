"use client";

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isTerminal } from "@/server/api/types";
import type { RowSize } from "@/server/data/schema";
import { api } from "./api";

export const queryKeys = {
  health: ["health"] as const,
  datasets: ["datasets"] as const,
  columns: (rows: RowSize) => ["datasets", rows, "columns"] as const,
  job: (jobId: string, page: number, pageSize: number) =>
    ["jobs", jobId, page, pageSize] as const,
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

/** 현재 페이지 item이 모두 끝난 상태가 될 때까지 진행 상태를 받아온다. */
export function useJob(
  jobId: string | undefined,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: queryKeys.job(jobId ?? "", page, pageSize),
    queryFn: () => api.job(jobId as string, page, pageSize),
    enabled: jobId !== undefined,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 250;
      const pageDone =
        data.totalItems !== null &&
        data.items.every((i) => isTerminal(i.status));
      return pageDone ? false : 250;
    },
  });
}
