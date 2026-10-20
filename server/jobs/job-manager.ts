// 렌더 job 실행기. 데이터셋 준비(init) → 데이터 조회 → item 렌더를 순서대로 진행한다.
// item은 Render Worker pool에 순서대로 넣고, 순서를 당기는 우선순위는 두지 않는다.
// 상태가 바뀔 때마다 version을 올려 long polling 대기자를 깨운다.

import {
  type ItemStage,
  type ItemState,
  isTerminal,
  type JobPhase,
  type JobStateResponse,
  type JobStatus,
} from "../api/types";
import {
  type ChartItem,
  type ChartRecord,
  pngUrl,
} from "../charts/chart-store";
import { itemKeyOf, itemLabelOf } from "../charts/item-key";
import { COLUMNS } from "../data/schema";
import { putPng } from "../png-store";
import { CancelledError } from "../render-pool";
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
};

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
  run(job)
    .catch((err) => {
      if (err instanceof CancelledError) {
        job.status = "cancelled";
      } else {
        console.error(`job ${job.id} failed`, err);
        job.status = "failed";
      }
    })
    .finally(() => touch(job));
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

function pageKeys(job: Job, page: number, pageSize: number) {
  return job.order.slice(page * pageSize, (page + 1) * pageSize);
}

function pageSettled(job: Job, page: number, pageSize: number) {
  if (isTerminal(job.status)) return true;
  if (job.phase !== "render") return false;
  return pageKeys(job, page, pageSize).every((k) =>
    isTerminal((job.items.get(k) as ItemState).status),
  );
}

/**
 * long polling: 클라이언트가 가진 version 이후로 바뀐 게 있거나,
 * 요청한 페이지가 모두 끝난 상태면 바로 돌아오고, 아니면 변화가 생길 때까지 기다린다.
 */
export async function waitForUpdate(
  job: Job,
  since: number,
  page: number,
  pageSize: number,
  timeoutMs: number,
) {
  if (job.version > since || pageSettled(job, page, pageSize)) return;
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

export function jobState(
  job: Job,
  page: number,
  pageSize: number,
): JobStateResponse {
  const items = pageKeys(job, page, pageSize).map((k) => ({
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
    page,
    pageSize,
    items,
  };
}

async function run(job: Job) {
  const { db, render } = getRuntime();
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
  const data = await db.call("chartData", {
    rows: spec.rows,
    x: spec.x,
    y: spec.y,
    splitBy: spec.splitBy,
  });
  throwIfCancelled();

  chart.items = data.groups.map((g) => ({
    key: itemKeyOf(g.values),
    label: itemLabelOf(g.values, spec.splitSeparator),
    values: g.values,
    version: 0,
  }));
  for (const item of chart.items) {
    job.items.set(item.key, {
      key: item.key,
      label: item.label,
      status: "queued",
      stage: "query",
      stageProgress: 1,
    });
  }
  job.order = chart.items.map((i) => i.key);
  job.phase = "render";
  touch(job);

  // ── item 렌더: pool에 순서대로 넣는다 ─────────────────────────
  const xKind =
    COLUMNS.find((c) => c.name === spec.x)?.type === "time" ? "time" : "number";
  await Promise.all(
    chart.items.map((item, i) => {
      const group = data.groups[i];
      const state = job.items.get(item.key) as ItemState;
      const setStage = (stage: ItemStage, ratio: number) => {
        state.stage = stage;
        state.stageProgress = ratio;
        touch(job);
      };
      return render
        .call(
          "renderScatter",
          {
            width: chart.itemSize.width,
            height: chart.itemSize.height,
            title: item.label,
            xKind,
            xs: data.xs.slice(group.start, group.end),
            ys: data.ys.slice(group.start, group.end),
            color: spec.common.color,
          },
          {
            signal,
            onStart: () => {
              state.status = "running";
              setStage("aggregate", 0);
            },
            onProgress: (p) => setStage(p.stage, p.ratio),
          },
        )
        .then(async (result) => {
          await storeResult(chart, item, result.png);
          item.meta = result.meta;
          state.image = item.image;
          state.status = "success";
        })
        .catch((err: unknown) => {
          if (err instanceof CancelledError) {
            state.status = "cancelled";
          } else {
            state.status = "failed";
            state.error = err instanceof Error ? err.message : String(err);
          }
        })
        .finally(() => touch(job));
    }),
  );

  const statuses = [...job.items.values()].map((s) => s.status);
  job.status = statuses.includes("cancelled")
    ? "cancelled"
    : statuses.includes("failed")
      ? "failed"
      : "success";
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
