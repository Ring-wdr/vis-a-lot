"use client";

import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type ColumnName,
  type CsvOptions,
  type DatasetId,
  type DatasetStatus,
  isTerminal,
  type JobStateResponse,
  type UploadTask,
} from "@/shared/api/types";
import { columnLookup } from "@/shared/lib/format";
import { ApiRequestError, api } from "./api";

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
  /** 데이터셋 하나에 딸린 query (스키마, 컬럼 요약, legend 값). 다시 적재하거나 지우면 통째로 버린다. */
  dataset: (id: DatasetId) => ["datasets", id] as const,
  schema: (id: DatasetId, ready: boolean) =>
    ["datasets", id, "schema", ready] as const,
  columnSummary: (id: DatasetId, column: ColumnName) =>
    ["datasets", id, "summary", column] as const,
  legendValues: (id: DatasetId, column: ColumnName | null) =>
    ["datasets", id, "legend-values", column] as const,
  job: (jobId: string, page: number, pageSize: number) =>
    ["jobs", jobId, page, pageSize] as const,
  jobRange: (jobId: string, offset: number, count: number) =>
    ["jobs", jobId, "range", offset, count] as const,
  jobProgress: (jobId: string) => ["jobs", jobId, "progress"] as const,
  jobItem: (jobId: string, key: string) =>
    ["jobs", jobId, "item", key] as const,
  shares: ["shares"] as const,
  share: (id: string) => ["shares", id] as const,
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

/** 목록에 없는 데이터셋(지운 업로드)의 이름 */
export const DELETED_DATASET_NAME = "삭제된 데이터";

/** 데이터셋 이름. 목록을 받기 전이면 id를, 목록에 없으면(지운 데이터) '삭제된 데이터'를 쓴다. */
export function useDatasetNames() {
  const datasets = useDatasets().data?.datasets;
  return useMemo(() => {
    const names = new Map(datasets?.map((d) => [d.id, d.name]));
    return (id: DatasetId) =>
      names.get(id) ?? (datasets ? DELETED_DATASET_NAME : id);
  }, [datasets]);
}

export function useDatasetStatus(id: DatasetId) {
  return useQuery({
    ...datasetsQuery,
    select: (data) => data.datasets.find((d) => d.id === id),
  });
}

export function useGenerateDataset() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.generateDataset,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.datasets }),
  });
}

/** 다시 적재하거나 지운 데이터셋은 스키마·요약이 달라지므로 딸린 query를 버리고 목록을 다시 받는다. */
export function useDatasetChanged() {
  const client = useQueryClient();
  return (id: DatasetId) => {
    client.removeQueries({ queryKey: queryKeys.dataset(id) });
    return client.invalidateQueries({
      queryKey: queryKeys.datasets,
      exact: true,
    });
  };
}

export function useRenameDataset() {
  const changed = useDatasetChanged();
  return useMutation({
    mutationFn: ({ id, name }: { id: DatasetId; name: string }) =>
      api.renameDataset(id, name),
    onSuccess: (_, { id }) => changed(id),
  });
}

/** 업로드 팝업의 미리보기. 옵션을 바꾸는 동안에는 직전 결과를 그대로 보여준다. */
export function useUploadPreview(
  stageId: string | undefined,
  file: number,
  options: CsvOptions,
) {
  return useQuery({
    queryKey: ["upload-preview", stageId, file, options],
    queryFn: ({ signal }) =>
      api.previewUpload(stageId as string, { file, options }, signal),
    enabled: stageId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

const UPLOAD_TASK_DONE = new Set(["done", "rejected", "failed"]);

/**
 * 확인을 누른 업로드의 진행 (long polling). 직전 버전을 since로 보내 바뀔 때만 응답을 받고,
 * 끝나면(done·rejected·failed) 멈춘다. attempt는 다시 확인을 누를 때마다 새로 받기 위한 값이다.
 */
export function useUploadTask(stageId: string | undefined, attempt: number) {
  const client = useQueryClient();
  const queryKey = ["upload-task", stageId, attempt];
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const prev = client.getQueryData<UploadTask>(queryKey);
      return api.uploadTask(stageId as string, prev?.version, signal);
    },
    enabled: stageId !== undefined && attempt > 0,
    refetchInterval: (query) =>
      query.state.data && UPLOAD_TASK_DONE.has(query.state.data.state)
        ? false
        : 1,
    refetchIntervalInBackground: true,
    ...LONG_POLL_RETRY,
  });
}

export function useDeleteDataset() {
  const changed = useDatasetChanged();
  return useMutation({
    mutationFn: api.deleteDataset,
    onSuccess: (_, id) => changed(id),
  });
}

/** 데이터셋 스키마 query. 적재가 끝나면 고유값 수가 생기므로 ready를 키에 넣어 그때 한 번 더 받는다. */
export function datasetSchemaQuery(
  id: DatasetId,
  state: DatasetStatus["state"] | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.schema(id, state === "ready"),
    queryFn: () => api.schema(id),
    enabled: state === "generating" || state === "ready",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** 데이터셋 스키마(컬럼과 타입). 등록한 데이터셋만 받을 수 있다. */
export function useDatasetSchema(id: DatasetId) {
  const status = useDatasetStatus(id);
  return useQuery(datasetSchemaQuery(id, status.data?.state));
}

/**
 * 컬럼 후보를 아직 못 보여주는 이유. 받는 중(loading)과 데이터가 없어서(missing·generating)를 나눠
 * '등록하세요' 안내가 단순히 받는 동안에 뜨지 않게 한다. deleted는 목록에 없는 데이터(지운 업로드)다.
 */
export type SchemaState =
  | "loading"
  | "missing"
  | "generating"
  | "ready"
  | "deleted";

export function useSchemaState(id: DatasetId): SchemaState {
  const status = useDatasetStatus(id);
  const schema = useDatasetSchema(id);
  // 목록을 받았는데 없으면 지운 데이터다. 남아 있는 스키마 캐시보다 먼저 본다.
  if (status.isSuccess && !status.data) return "deleted";
  if (schema.data) return "ready";
  const state = status.data?.state;
  if (state === "missing") return "missing";
  if (state === "generating") return "generating";
  // 목록을 받는 중이거나, 준비됐는데 스키마를 받는 중이다.
  return status.isError ? "missing" : "loading";
}

/** 이 데이터셋의 컬럼 라벨·타입. 같은 이름의 컬럼이라도 데이터셋마다 다를 수 있어 데이터셋별로 찾는다. */
export function useColumns(id: DatasetId) {
  const columns = useDatasetSchema(id).data?.columns;
  return useMemo(() => columnLookup(columns), [columns]);
}

/** 여러 데이터셋의 컬럼 라벨·타입 (history 목록처럼 데이터셋이 섞인 곳). 데이터셋으로 찾아 쓴다. */
export function useColumnsByDataset(ids: readonly DatasetId[]) {
  const datasets = useDatasets();
  const unique = [...new Set(ids)];
  return useQueries({
    queries: unique.map((id) =>
      datasetSchemaQuery(
        id,
        datasets.data?.datasets.find((d) => d.id === id)?.state,
      ),
    ),
    combine: (results) => (id: DatasetId) =>
      columnLookup(results[unique.indexOf(id)]?.data?.columns),
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
 * 페이지 경계와 상관없이 offset 순번부터 count개 item을 long polling으로 받는다 (크게 보기 섬네일 목록).
 * 범위를 옮기는 동안에는 이전 응답을 그대로 둔다. 응답의 offset으로 어느 범위인지 구분한다.
 */
export function useJobRange(
  jobId: string | undefined,
  offset: number,
  count: number,
) {
  const client = useQueryClient();
  const queryKey = queryKeys.jobRange(jobId ?? "", offset, count);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const prev = client.getQueryData<JobStateResponse>(queryKey);
      return api.jobRange(
        jobId as string,
        offset,
        count,
        prev?.version ?? -1,
        signal,
      );
    },
    enabled: jobId !== undefined,
    placeholderData: keepPreviousData,
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

/**
 * 툴팁 query는 한 번 실패하면 그 PNG에서 툴팁이 다시는 안 나오므로 몇 번 더 시도한다
 * (service worker 재시작, 다시 그린 직후 metadata가 아직 없을 때 등).
 */
const TOOLTIP_RETRY = {
  retry: 3,
  retryDelay: (attempt: number) => Math.min(250 * 2 ** attempt, 2000),
} as const;

/** item에 처음 커서를 올릴 때 받아 오고, 같은 PNG 버전이면 다시 받지 않는다. */
export function useItemMeta(pngUrl: string, enabled: boolean) {
  return useQuery(itemMetaQuery(pngUrl, enabled));
}

export function itemMetaQuery(pngUrl: string, enabled = true) {
  return queryOptions({
    queryKey: ["meta", pngUrl],
    queryFn: () => api.itemMeta(pngUrl),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
    ...TOOLTIP_RETRY,
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
    ...TOOLTIP_RETRY,
    // 404(지운 데이터셋·차트)는 다시 물어도 같다.
    retry: (count, err) =>
      !(err instanceof ApiRequestError && err.status === 404) &&
      count < TOOLTIP_RETRY.retry,
  });
}

/** legend 값 목록. 데이터셋이 준비된 뒤에만 받을 수 있다. */
export function useLegendValues(
  id: DatasetId,
  column: ColumnName | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.legendValues(id, column),
    queryFn: () => api.legendValues(id, column as ColumnName),
    enabled: enabled && column !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** 필터 아코디언을 열 때 그 컬럼의 범위나 값 목록을 서버에서 받는다. 데이터는 바뀌지 않으므로 다시 받지 않는다. */
export function useColumnSummary(id: DatasetId, column: ColumnName) {
  return useQuery({
    queryKey: queryKeys.columnSummary(id, column),
    queryFn: () => api.columnSummary(id, column),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// ── 공유 ───────────────────────────────────────────────────────

/** 내가 만든 공유 목록 */
export function useShares() {
  return useQuery({ queryKey: queryKeys.shares, queryFn: api.shares });
}

/** 공유 한 건. 스냅숏이라 바뀌지 않으므로 다시 받지 않는다. 없으면(404) 다시 시도하지 않는다. */
export function useShare(id: string) {
  return useQuery({
    queryKey: queryKeys.share(id),
    queryFn: () => api.share(id),
    enabled: id !== "",
    staleTime: Number.POSITIVE_INFINITY,
    retry: (count, err) =>
      !(err instanceof ApiRequestError && err.status === 404) && count < 2,
  });
}

export function useDeleteShare() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.deleteShare,
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: queryKeys.share(id) });
      return client.invalidateQueries({ queryKey: queryKeys.shares });
    },
  });
}
