// 렌더 job 실행기. 데이터셋 준비(init) → 데이터 조회 → item 렌더를 순서대로 진행한다.
// item은 Render Worker pool에 순서대로 넣고, 순서를 당기는 우선순위는 두지 않는다.

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
import { getRuntime } from "../runtime";

type Job = {
  id: string;
  chart: ChartRecord;
  status: JobStatus;
  phase: JobPhase;
  dataset: { done: number; total: number };
  items: Map<string, ItemState>;
  order: string[];
};

const jobs = new Map<string, Job>();
const DATASET_POLL_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startJob(chart: ChartRecord): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    chart,
    status: "init",
    phase: "dataset",
    dataset: { done: 0, total: chart.spec.rows },
    items: new Map(),
    order: [],
  };
  jobs.set(job.id, job);
  run(job).catch((err) => {
    console.error(`job ${job.id} failed`, err);
    job.status = "failed";
  });
  return job;
}

export function getJob(id: string) {
  return jobs.get(id);
}

export function jobState(
  job: Job,
  page: number,
  pageSize: number,
): JobStateResponse {
  const pageKeys = job.order.slice(page * pageSize, (page + 1) * pageSize);
  const items = pageKeys.map((k) => ({ ...(job.items.get(k) as ItemState) }));
  const done = [...job.items.values()].filter((i) =>
    isTerminal(i.status),
  ).length;
  return {
    jobId: job.id,
    chartId: job.chart.id,
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

  // ── init: 데이터가 없으면 생성이 끝날 때까지 기다린다 ──────────
  for (;;) {
    const status = await db.call("ensureDataset", { rows: spec.rows });
    job.dataset = { done: status.done, total: status.total };
    if (status.state === "ready") break;
    await sleep(DATASET_POLL_MS);
  }

  // ── 데이터 조회: split 조합이 곧 item 목록이다 ─────────────────
  job.status = "progress";
  job.phase = "query";
  const data = await db.call("chartData", {
    rows: spec.rows,
    x: spec.x,
    y: spec.y,
    splitBy: spec.splitBy,
  });

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
          state.status = "failed";
          state.error = err instanceof Error ? err.message : String(err);
        });
    }),
  );

  const failed = [...job.items.values()].some((s) => s.status === "failed");
  job.status = failed ? "failed" : "success";
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
