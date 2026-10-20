// 렌더 job 실행기. 데이터셋 준비(init) → 데이터 조회 → item 렌더를 순서대로 진행한다.
// item은 Render Worker pool에 순서대로 넣고, 순서를 당기는 우선순위는 두지 않는다.
// 상태가 바뀔 때마다 version을 올려 long polling 대기자를 깨운다.

import {
  type ItemMeta,
  type ItemStage,
  type ItemState,
  isTerminal,
  type JobPhase,
  type JobStateResponse,
  type JobStatus,
} from "../api/types";
import {
  type CachedChartData,
  type ChartItem,
  type ChartRecord,
  cacheChartData,
  getCachedChartData,
  getItem,
  pngUrl,
} from "../charts/chart-store";
import { itemKeyOf, itemLabelOf } from "../charts/item-key";
import { COLUMNS, MAX_SPLIT_ITEMS } from "../data/schema";
import { saveHistory } from "../history/recorder";
import { putPng } from "../png-store";
import { CancelledError, type PoolCallOptions } from "../render-pool";
import { getRuntime } from "../runtime";

type Job = {
  id: string;
  chart: ChartRecord;
  status: JobStatus;
  phase: JobPhase;
  dataset: { done: number; total: number };
  items: Map<string, ItemState>;
  order: string[];
  version: number;
  waiters: Set<() => void>;
  abort: AbortController;
  error?: string;
};

/** 사용자에게 그대로 보여줄 수 있는 job 실패 사유 */
class JobError extends Error {}

const jobs = new Map<string, Job>();
const DATASET_POLL_MS = 300;
/** 잦은 진행률 변화를 한 응답으로 묶기 위한 짧은 지연 */
const BATCH_MS = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function touch(job: Job) {
  job.version++;
  for (const wake of job.waiters) wake();
  job.waiters.clear();
}

export function startJob(chart: ChartRecord): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    chart,
    status: "init",
    phase: "dataset",
    dataset: { done: 0, total: chart.spec.rows },
    items: new Map(),
    order: [],
    version: 0,
    waiters: new Set(),
    abort: new AbortController(),
  };
  jobs.set(job.id, job);
  chart.primaryJobId = job.id;
  run(job)
    .catch((err) => {
      if (err instanceof CancelledError) {
        job.status = "cancelled";
      } else if (err instanceof JobError) {
        job.status = "failed";
        job.error = err.message;
      } else {
        console.error(`job ${job.id} failed`, err);
        job.status = "failed";
      }
    })
    .finally(() => {
      touch(job);
      if (isTerminal(job.status)) persistHistory(chart);
    });
  return job;
}

export function getJob(id: string) {
  return jobs.get(id);
}

/** 아직 시작하지 않은 item을 취소한다. 이미 그리는 중인 item은 끝까지 그린다. */
export function cancelJob(job: Job) {
  if (isTerminal(job.status)) return;
  job.abort.abort();
  touch(job);
}

/** 응답에 담을 item: 페이지 단위, 또는 키를 지정하면 그 item들 */
export type ItemSelection =
  | { page: number; pageSize: number }
  | { keys: string[] };

function selectedKeys(job: Job, selection: ItemSelection) {
  if ("keys" in selection)
    return selection.keys.filter((k) => job.items.has(k));
  const { page, pageSize } = selection;
  return job.order.slice(page * pageSize, (page + 1) * pageSize);
}

/** 고른 item이 없으면(pageSize 0) job 전체 진행 상태만 받는 요청이다. job이 끝나야 더 기다릴 게 없다. */
function selectionSettled(job: Job, selection: ItemSelection) {
  if (isTerminal(job.status)) return true;
  const keys = selectedKeys(job, selection);
  if (keys.length === 0 || job.phase !== "render") return false;
  return keys.every((k) => isTerminal((job.items.get(k) as ItemState).status));
}

/**
 * long polling: 클라이언트가 가진 version 이후로 바뀐 게 있거나,
 * 요청한 페이지가 모두 끝난 상태면 바로 돌아오고, 아니면 변화가 생길 때까지 기다린다.
 */
export async function waitForUpdate(
  job: Job,
  since: number,
  selection: ItemSelection,
  timeoutMs: number,
) {
  if (job.version > since || selectionSettled(job, selection)) return;
  await new Promise<void>((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      job.waiters.delete(wake);
      resolve();
    }, timeoutMs);
    job.waiters.add(wake);
  });
  await sleep(BATCH_MS);
}

export function jobState(job: Job, selection: ItemSelection): JobStateResponse {
  const items = selectedKeys(job, selection).map((k) => ({
    ...(job.items.get(k) as ItemState),
  }));
  const done = [...job.items.values()].filter((i) =>
    isTerminal(i.status),
  ).length;
  return {
    jobId: job.id,
    chartId: job.chart.id,
    version: job.version,
    status: job.status,
    phase: job.phase,
    progress:
      job.phase === "dataset"
        ? { ...job.dataset }
        : { done, total: job.order.length },
    totalItems: job.phase === "render" ? job.order.length : null,
    page: "page" in selection ? selection.page : 0,
    pageSize: "pageSize" in selection ? selection.pageSize : 0,
    items,
    error: job.error,
  };
}

async function run(job: Job) {
  const { db } = getRuntime();
  const { chart } = job;
  const { spec } = chart;
  const { signal } = job.abort;
  const throwIfCancelled = () => {
    if (signal.aborted) throw new CancelledError();
  };

  // ── init: 데이터가 없으면 생성이 끝날 때까지 기다린다 ──────────
  for (;;) {
    throwIfCancelled();
    const status = await db.call("ensureDataset", { rows: spec.rows });
    job.dataset = { done: status.done, total: status.total };
    touch(job);
    if (status.state === "ready") break;
    await sleep(DATASET_POLL_MS);
  }

  // ── 데이터 조회: split 조합이 곧 item 목록이다 ─────────────────
  throwIfCancelled();
  job.status = "progress";
  job.phase = "query";
  touch(job);
  // 데이터가 없는 상태에서 draw한 경우를 위해 여기서도 조합 개수를 확인한다.
  const split = await db.call("splitCount", {
    rows: spec.rows,
    cols: spec.splitBy,
    limit: MAX_SPLIT_ITEMS,
  });
  if (split.count > MAX_SPLIT_ITEMS) {
    throw new JobError(
      `split 조합이 ${split.count.toLocaleString()}개로 최대 ${MAX_SPLIT_ITEMS.toLocaleString()}개를 넘습니다.`,
    );
  }
  const data = await loadChartData(chart);
  throwIfCancelled();

  chart.items = data.groups.map((g) => {
    const key = itemKeyOf(g.values);
    // history 복원/공유 링크: 같은 split 조합이면 확대·도형·개별 색을 되살린다.
    const restored = chart.restore?.[key];
    return {
      key,
      label: itemLabelOf(g.values, spec.splitSeparator),
      values: g.values,
      version: 0,
      view: restored?.view,
      shapes: restored?.shapes ?? [],
      props: restored?.color ? { color: restored.color } : undefined,
    };
  });
  for (const item of chart.items)
    job.items.set(item.key, initialState(chart, item));
  job.order = chart.items.map((i) => i.key);
  job.phase = "render";
  touch(job);

  await renderItems(job, data, chart.items);
  job.status = finalStatus(job);
}

/** 차트의 현재 상태를 history에 저장한다. item 상태는 grid가 보는 primary job 기준이다. */
function persistHistory(chart: ChartRecord) {
  const primary = chart.primaryJobId ? jobs.get(chart.primaryJobId) : undefined;
  const statuses = new Map(
    [...(primary?.items.values() ?? [])].map((s) => [s.key, s.status]),
  );
  saveHistory(chart, primary?.status ?? "init", statuses).catch((err) =>
    console.error("history save failed", err),
  );
}

/**
 * item 일부만 다시 그리는 job (확대/축소, 도형, 개별 속성, resize).
 * 결과는 draw job의 item 상태에도 반영해 grid가 새 PNG를 보게 한다.
 */
export function startItemJob(
  chart: ChartRecord,
  keys: string[],
  {
    primary = false,
    record = true,
  }: {
    primary?: boolean;
    /** history에 남길지. resize는 남기지 않는다. */
    record?: boolean;
  } = {},
): Job {
  const items = keys
    .map((k) => getItem(chart, k))
    .filter((i): i is ChartItem => i !== undefined);
  const job: Job = {
    id: crypto.randomUUID(),
    chart,
    status: "progress",
    phase: "render",
    dataset: { done: chart.spec.rows, total: chart.spec.rows },
    items: new Map(items.map((i) => [i.key, initialState(chart, i)])),
    order: items.map((i) => i.key),
    version: 0,
    waiters: new Set(),
    abort: new AbortController(),
  };
  jobs.set(job.id, job);
  // 전체를 다시 그리는 job(공통 속성 변경)은 grid가 바라보는 primary job이 된다.
  if (primary) chart.primaryJobId = job.id;
  for (const item of items) item.busyJobId = job.id;

  (async () => {
    const data = await loadChartData(chart);
    await renderItems(job, data, items);
    job.status = finalStatus(job);
  })()
    .catch((err) => {
      console.error(`item job ${job.id} failed`, err);
      job.status = "failed";
    })
    .finally(() => {
      for (const item of items) {
        if (item.busyJobId === job.id) item.busyJobId = undefined;
      }
      touch(job);
      if (record) persistHistory(chart);
    });
  return job;
}

function initialState(chart: ChartRecord, item: ChartItem): ItemState {
  return {
    key: item.key,
    label: item.label,
    status: "queued",
    stage: "query",
    stageProgress: 1,
    image: item.image,
    zoomed: item.view !== undefined,
    shapeCount: item.shapes.length,
    color: itemColor(chart, item),
    customColor: item.props?.color !== undefined,
  };
}

/** 개별 색이 있으면 그 색, 없으면 공통 색 */
export function itemColor(chart: ChartRecord, item: ChartItem) {
  return item.props?.color ?? chart.spec.common.color;
}

function finalStatus(job: Job): JobStatus {
  const statuses = [...job.items.values()].map((s) => s.status);
  return statuses.includes("cancelled")
    ? "cancelled"
    : statuses.includes("failed")
      ? "failed"
      : "success";
}

/** 차트 데이터를 메모리 캐시에서 꺼내고, 밀려났으면 다시 조회한다. */
async function loadChartData(chart: ChartRecord): Promise<CachedChartData> {
  const cached = getCachedChartData(chart.id);
  if (cached) return cached;
  const { db } = getRuntime();
  const { spec } = chart;
  const result: CachedChartData =
    spec.chartType === "scatter"
      ? {
          kind: "scatter",
          ...(await db.call("chartData", {
            rows: spec.rows,
            x: spec.x,
            y: spec.y,
            splitBy: spec.splitBy,
          })),
          groupOf: new Map(),
        }
      : {
          kind: "category",
          ...(await db.call("categoryData", {
            rows: spec.rows,
            chartType: spec.chartType,
            x: spec.x,
            y: spec.y,
            agg: spec.agg,
            splitBy: spec.splitBy,
          })),
          groupOf: new Map(),
        };
  result.groups.forEach((g, i) => {
    result.groupOf.set(itemKeyOf(g.values), i);
  });
  cacheChartData(chart.id, result);
  return result;
}

type RenderOutput = { png: ArrayBuffer; meta: ItemMeta };

/** 차트 종류에 맞는 렌더러를 골라 item 하나를 그린다. */
function renderItem(
  chart: ChartRecord,
  data: CachedChartData,
  item: ChartItem,
  options: PoolCallOptions<"renderScatter" | "renderCategory">,
): Promise<RenderOutput> {
  const { render } = getRuntime();
  const { spec, itemSize } = chart;
  const index = data.groupOf.get(item.key);
  const common = {
    width: itemSize.width,
    height: itemSize.height,
    title: item.label,
    color: itemColor(chart, item),
    view: item.view,
    shapes: item.shapes,
  };
  if (data.kind === "scatter") {
    const group =
      index === undefined ? { start: 0, end: 0 } : data.groups[index];
    return render.call(
      "renderScatter",
      {
        ...common,
        xKind:
          COLUMNS.find((c) => c.name === spec.x)?.type === "time"
            ? "time"
            : "number",
        xs: data.xs.slice(group.start, group.end),
        ys: data.ys.slice(group.start, group.end),
        ids: data.ids.slice(group.start, group.end),
      },
      options,
    );
  }
  const group = index === undefined ? undefined : data.groups[index];
  return render.call(
    "renderCategory",
    {
      ...common,
      chartType: spec.chartType === "bar" ? "bar" : "boxplot",
      categories: group?.categories ?? [],
      bars: group?.bars,
      boxes: group?.boxes,
      agg: spec.chartType === "bar" ? spec.agg : undefined,
    },
    options,
  );
}

/** item들을 pool에 순서대로 넣는다. 순서를 당기는 우선순위는 두지 않는다. */
async function renderItems(
  job: Job,
  data: CachedChartData,
  items: ChartItem[],
) {
  const { chart } = job;
  const { signal } = job.abort;

  await Promise.all(
    items.map((item) => {
      const state = job.items.get(item.key) as ItemState;
      const setStage = (stage: ItemStage, ratio: number) => {
        state.stage = stage;
        state.stageProgress = ratio;
        touch(job);
      };
      return renderItem(chart, data, item, {
        signal,
        onStart: () => {
          state.status = "running";
          setStage("aggregate", 0);
        },
        onProgress: (p) => setStage(p.stage, p.ratio),
      })
        .then(async (result) => {
          await storeResult(chart, item, result.png);
          item.meta = result.meta;
          if (!item.view) {
            item.fullView = {
              x: result.meta.x.domain,
              y: result.meta.y.domain,
            };
          }
          state.image = item.image;
          state.color = itemColor(chart, item);
          state.customColor = item.props?.color !== undefined;
          state.status = "success";
          syncPrimary(chart, item);
        })
        .catch((err: unknown) => {
          if (err instanceof CancelledError) {
            state.status = "cancelled";
          } else {
            state.status = "failed";
            state.error = err instanceof Error ? err.message : String(err);
          }
        })
        .finally(() => {
          // job 전체를 기다리지 않고 이 item이 끝나는 즉시 다음 조작(다음 resize 등)을 받는다.
          if (item.busyJobId === job.id) item.busyJobId = undefined;
          touch(job);
        });
    }),
  );
}

/** item 단위로 다시 그린 결과를 draw job의 item 상태에 반영한다. */
function syncPrimary(chart: ChartRecord, item: ChartItem) {
  const primary = chart.primaryJobId ? jobs.get(chart.primaryJobId) : undefined;
  const state = primary?.items.get(item.key);
  if (!primary || !state) return;
  state.image = item.image;
  state.zoomed = item.view !== undefined;
  state.shapeCount = item.shapes.length;
  state.color = itemColor(chart, item);
  state.customColor = item.props?.color !== undefined;
  touch(primary);
}

async function storeResult(
  chart: ChartRecord,
  item: ChartItem,
  png: ArrayBuffer,
) {
  item.version++;
  const url = pngUrl(chart.id, item);
  await putPng(new URL(url, location.origin).href, png);
  item.image = {
    url,
    width: chart.itemSize.width,
    height: chart.itemSize.height,
  };
}
