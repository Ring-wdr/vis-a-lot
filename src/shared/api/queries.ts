"use client";

import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ColumnName,
  type DatasetStatus,
  isTerminal,
  type JobStateResponse,
  type RowSize,
} from "@/shared/api/types";
import { registerColumns } from "@/shared/lib/format";
import { api } from "./api";

/**
 * long polling 요청은 한 번 실패해도 멈추면 안 된다 (service worker 재시작 등).
 * 짧은 간격으로 계속 다시 시도한다.
 */
const LONG_POLL_RETRY = {
  retry: true,
  retryDelay: (attempt: number) => Math.min(250 * 2 ** attempt, 3000),
} as const;

export const queryKeys = {
  health: ["health"] as const,
  datasets: ["datasets"] as const,
  schema: (rows: RowSize, ready: boolean) =>
    ["datasets", rows, "schema", ready] as const,
  columnSummary: (rows: RowSize, column: ColumnName) =>
    ["datasets", rows, "summary", column] as const,
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

/** data 서비스(DB)와 chart 서비스(Render Worker) 상태를 함께 본다. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => {
      const [data, chart] = await Promise.all([
        api.health(),
        api.chartHealth(),
      ]);
      return { db: data.db, renderWorkers: chart.renderWorkers };
    },
  });
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

/** 데이터셋 스키마 query. 적재가 끝나면 고유값 수가 생기므로 ready를 키에 넣어 그때 한 번 더 받는다. */
export function datasetSchemaQuery(
  rows: RowSize,
  state: DatasetStatus["state"] | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.schema(rows, state === "ready"),
    queryFn: async () => {
      const schema = await api.schema(rows);
      registerColumns(schema.columns);
      return schema;
    },
    enabled: state !== undefined && state !== "missing",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * 데이터셋 스키마(컬럼과 타입). 등록한 데이터셋만 받을 수 있다. 받으면 컬럼 라벨·타입을 등록해
 * 스키마를 직접 들고 있지 않은 화면(history 목록, 툴팁)도 이름으로 찾아 쓰게 한다.
 */
export function useDatasetSchema(rows: RowSize) {
  const status = useDatasetStatus(rows);
  return useQuery(datasetSchemaQuery(rows, status.data?.state));
}

/** 여러 데이터셋의 스키마를 함께 받는다 (history 목록처럼 데이터셋이 섞인 곳의 컬럼 라벨용). */
export function useDatasetSchemas(rowsList: readonly RowSize[]) {
  const datasets = useDatasets();
  return useQueries({
    queries: [...new Set(rowsList)].map((rows) =>
      datasetSchemaQuery(
        rows,
        datasets.data?.datasets.find((d) => d.rows === rows)?.state,
      ),
    ),
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
    ...LONG_POLL_RETRY,
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
    queryFn: async ({ signal }) => {
      const prev = client.getQueryData<JobStateResponse>(queryKey);
      const next = await api.job(
        jobId as string,
        0,
        0,
        prev?.version ?? -1,
        signal,
      );
      // 데이터가 없으면 chart 서비스가 data 서비스에 적재를 요청한다. 화면이 모르는 사이
      // 데이터셋 상태가 바뀌므로, 준비 단계에 들어가거나 벗어날 때 데이터셋 목록을 다시 받는다.
      if ((prev?.phase === "dataset") !== (next.phase === "dataset")) {
        client.invalidateQueries({ queryKey: queryKeys.datasets });
      }
      return next;
    },
    enabled: jobId !== undefined,
    refetchInterval: (query) =>
      query.state.data && isTerminal(query.state.data.status) ? false : 1,
    refetchIntervalInBackground: true,
    ...LONG_POLL_RETRY,
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
    ...LONG_POLL_RETRY,
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

/** legend 값 목록. 데이터셋이 준비된 뒤에만 받을 수 있다. */
export function useLegendValues(
  rows: RowSize,
  column: ColumnName | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["legend-values", rows, column],
    queryFn: () => api.legendValues(rows, column as ColumnName),
    enabled: enabled && column !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** 필터 아코디언을 열 때 그 컬럼의 범위나 값 목록을 서버에서 받는다. 데이터는 바뀌지 않으므로 다시 받지 않는다. */
export function useColumnSummary(rows: RowSize, column: ColumnName) {
  return useQuery({
    queryKey: queryKeys.columnSummary(rows, column),
    queryFn: () => api.columnSummary(rows, column),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
