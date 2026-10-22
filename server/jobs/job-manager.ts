// 렌더 job 실행기. 데이터셋 준비(init) → 데이터 조회 → item 렌더를 순서대로 진행한다.
// item은 Render Worker pool에 순서대로 넣고, 순서를 당기는 우선순위는 두지 않는다.
// 상태가 바뀔 때마다 version을 올려 long polling 대기자를 깨운다.

import {
  type ItemMeta,
  type ItemProps,
  type ItemSize,
  type ItemStage,
  type ItemState,
  isTerminal,
  type JobPhase,
  type JobStateResponse,
  type JobStatus,
} from "../api/types";
import {
  CHART_FIELDS,
  legendColumnOf,
  POINT_CHARTS,
} from "../charts/chart-fields";
import { resolveOptions } from "../charts/chart-options";
import {
  bumpRevision,
  type CachedChartData,
  type ChartItem,
  type ChartRecord,
  cacheChartData,
  detailUrl,
  getCachedChartData,
  getItem,
  pngUrl,
  putDetail,
  sizeKeyOf,
  THUMBNAIL_SIZE,
  thumbnailUrl,
} from "../charts/chart-store";
import { itemKeyOf, itemLabelOf } from "../charts/item-key";
import { specError } from "../charts/validate-spec";
import { OTHERS_SLICE, type PieData } from "../data/polar-data";
import { MAX_SPLIT_ITEMS } from "../data/schema";
import { saveHistory } from "../history/recorder";
import { deletePngs, putPng } from "../png-store";
import { CANDLE_LEGEND } from "../render/candle";
import { gradientColors, legendStyleOf } from "../render/style";
import { defaultLegendColor, OTHERS_COLOR } from "../render/theme";
import { WATERFALL_KINDS, waterfallDefaultColors } from "../render/waterfall";
import { CancelledError, type PoolCallOptions } from "../render-pool";
import { getRuntime } from "../runtime";
import {
  DataServiceError,
  dataService,
} from "../services/chart/clients/data-service";

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
  /** draw(조회부터) 또는 redraw(그린 item 다시 그리기) */
  kind: "draw" | "redraw";
  /** epoch ms. 하단 바가 경과 시간·처리 속도·남은 시간을 계산한다. */
  timing: { createdAt: number; renderStartedAt?: number; endedAt?: number };
};

/**
 * 무엇을 그리는지.
 * - item: grid에 놓일 PNG. 내용이 바뀐 경우(thumbnail)에는 고정 크기 섬네일도 같은 렌더에서 함께 그린다.
 * - detail: 크게 보기용 PNG 한 장. grid PNG와 섬네일은 건드리지 않는다.
 */
type RenderTarget =
  | { kind: "item"; thumbnail: boolean }
  | { kind: "detail"; size: ItemSize; revision: number };

/** 사용자에게 그대로 보여줄 수 있는 job 실패 사유 */
class JobError extends Error {}

/** data 서비스가 모르는 데이터셋(404): 지운 업로드 */
const DATASET_DELETED =
  "삭제된 데이터라 그릴 수 없습니다. datastore에서 다른 데이터를 고르세요.";
/** data 서비스가 준비되지 않았다고 답함(409) */
const DATASET_NOT_READY = "데이터가 아직 준비되지 않았습니다.";
const REDRAW_FAILED = "다시 그리지 못했습니다.";

/** 사용자에게 보여줄 실패 사유. data 서비스 오류는 상태 코드로 가르고, 모르는 오류면 undefined */
function reasonOf(err: unknown): string | undefined {
  if (err instanceof JobError) return err.message;
  if (err instanceof DataServiceError) {
    if (err.status === 404) return DATASET_DELETED;
    if (err.status === 409) return DATASET_NOT_READY;
  }
  return undefined;
}

/** job이 중간에 실패하면 끝나지 않은 item도 실패로 남긴다. 화면은 item이 끝나기를 기다리기 때문이다. */
function failItems(job: Job, items: ChartItem[], error: string) {
  for (const item of items) {
    const state = job.items.get(item.key);
    if (state && !isTerminal(state.status)) {
      job.items.set(item.key, { ...state, status: "failed", error });
    }
  }
}

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
    dataset: { done: 0, total: 0 },
    items: new Map(),
    order: [],
    version: 0,
    waiters: new Set(),
    abort: new AbortController(),
    kind: "draw",
    timing: { createdAt: Date.now() },
  };
  jobs.set(job.id, job);
  chart.primaryJobId = job.id;
  run(job)
    .catch((err) => {
      if (err instanceof CancelledError) {
        job.status = "cancelled";
      } else {
        job.status = "failed";
        job.error = reasonOf(err);
        if (!job.error) console.error(`job ${job.id} failed`, err);
      }
    })
    .finally(() => {
      job.timing.endedAt = Date.now();
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
  | {
      page: number;
      pageSize: number;
      /** 지정하면 페이지 경계와 상관없이 이 순번부터 pageSize개 (크게 보기 섬네일 목록) */
      offset?: number;
    }
  | { keys: string[] };

function selectedKeys(job: Job, selection: ItemSelection) {
  if ("keys" in selection)
    return selection.keys.filter((k) => job.items.has(k));
  const start = startOf(selection);
  return job.order.slice(start, start + selection.pageSize);
}

/** 응답 item 중 첫 item의 전체 순번 */
function startOf(selection: ItemSelection) {
  if ("keys" in selection) return 0;
  return selection.offset ?? selection.page * selection.pageSize;
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
  const counts = { queued: 0, running: 0, success: 0, failed: 0, cancelled: 0 };
  for (const item of job.items.values()) counts[item.status]++;
  const done = counts.success + counts.failed + counts.cancelled;
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
    offset: startOf(selection),
    items,
    error: job.error,
    kind: job.kind,
    counts,
    timing: { ...job.timing },
    renderWorkers: getRuntime().render.size,
  };
}

async function run(job: Job) {
  const { chart } = job;
  const { spec } = chart;
  const { signal } = job.abort;
  const throwIfCancelled = () => {
    if (signal.aborted) throw new CancelledError();
  };

  // ── init: 데이터가 없으면 data 서비스에 적재를 요청하고 끝날 때까지 기다린다 ──
  for (;;) {
    throwIfCancelled();
    const status = await dataService.ensureDataset(spec.dataset);
    job.dataset = { done: status.done, total: status.total };
    touch(job);
    if (status.state === "ready") break;
    if (status.state === "failed" || status.state === "missing") {
      throw new JobError(
        status.error ?? `데이터셋 '${status.name}'이 준비되지 않았습니다.`,
      );
    }
    await sleep(DATASET_POLL_MS);
  }

  // ── 스키마 확인: 컬럼 이름과 타입은 데이터마다 다르므로 데이터가 준비된 뒤에 본다 ──
  throwIfCancelled();
  job.status = "progress";
  job.phase = "query";
  touch(job);
  const schema = await dataService.schema(spec.dataset);
  const invalid = specError(spec, schema.columns);
  if (invalid) throw new JobError(invalid);
  chart.columns = schema.columns;

  // ── 데이터 조회: split 조합이 곧 item 목록이다 ─────────────────
  // 데이터가 없는 상태에서 draw한 경우를 위해 여기서도 조합 개수를 확인한다.
  const split = await dataService.splitCount(
    spec.dataset,
    spec.splitBy,
    spec.filters,
  );
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
      revision: 0,
      details: new Map(),
      detailJobs: new Map(),
      view: restored?.view,
      shapes: restored?.shapes ?? [],
      selection: restored?.selection,
      favorites: restored?.favorites ?? [],
      legendGroups: restored?.legendGroups ?? [],
      deletions: restored?.deletions ?? [],
      props: propsOrNone({
        color: restored?.color,
        legendColors: restored?.legendColors,
        legendPosition: restored?.legendPosition,
        hiddenLegend: restored?.hiddenLegend,
        options: restored?.options,
      }),
    };
  });
  for (const item of chart.items)
    job.items.set(item.key, initialState(chart, item));
  job.order = chart.items.map((i) => i.key);
  job.phase = "render";
  job.timing.renderStartedAt = Date.now();
  touch(job);

  await renderItems(job, data, chart.items, { kind: "item", thumbnail: true });
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

function redrawJob(chart: ChartRecord, items: ChartItem[]): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    chart,
    status: "progress",
    phase: "render",
    // 다시 그리기는 데이터가 이미 준비된 뒤라 draw job의 적재 상태를 그대로 보여준다.
    dataset: {
      ...((chart.primaryJobId && jobs.get(chart.primaryJobId)?.dataset) || {
        done: 1,
        total: 1,
      }),
    },
    items: new Map(items.map((i) => [i.key, initialState(chart, i)])),
    order: items.map((i) => i.key),
    version: 0,
    waiters: new Set(),
    abort: new AbortController(),
    kind: "redraw",
    timing: { createdAt: Date.now(), renderStartedAt: Date.now() },
  };
  jobs.set(job.id, job);
  return job;
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
    content = true,
  }: {
    primary?: boolean;
    /** history에 남길지. resize는 남기지 않는다. */
    record?: boolean;
    /** 그림 내용이 바뀌었는지. 크기만 바뀌면(resize, grid) 섬네일과 상세 PNG를 그대로 둔다. */
    content?: boolean;
  } = {},
): Job {
  const items = keys
    .map((k) => getItem(chart, k))
    .filter((i): i is ChartItem => i !== undefined);
  // 예전 내용으로 그린 상세 PNG는 더 쓸 일이 없으니 지운다.
  if (content) {
    deletePngs(items.flatMap(bumpRevision)).catch((err) =>
      console.warn("stale detail png cleanup failed", err),
    );
  }
  const job = redrawJob(chart, items);
  // 전체를 다시 그리는 job(공통 속성 변경)은 grid가 바라보는 primary job이 된다.
  if (primary) chart.primaryJobId = job.id;
  for (const item of items) item.busyJobId = job.id;

  (async () => {
    const data = await itemData(chart);
    await renderItems(job, data, items, { kind: "item", thumbnail: content });
    job.status = finalStatus(job);
  })()
    .catch((err) => {
      const reason = reasonOf(err);
      if (!reason) console.error(`item job ${job.id} failed`, err);
      job.error = reason ?? REDRAW_FAILED;
      failItems(job, items, job.error);
      job.status = "failed";
    })
    .finally(() => {
      job.timing.endedAt = Date.now();
      for (const item of items) {
        if (item.busyJobId === job.id) item.busyJobId = undefined;
      }
      touch(job);
      if (record) persistHistory(chart);
    });
  return job;
}

/**
 * 크게 보기용 PNG를 그 크기로 한 장 그리는 job. 조작 차단(busy)도, history 기록도 하지 않는다.
 * 같은 크기를 이미 그리는 중이면 그 job을 돌려준다.
 */
export function startDetailJob(
  chart: ChartRecord,
  item: ChartItem,
  size: ItemSize,
): Job {
  const sizeKey = sizeKeyOf(size);
  const running = item.detailJobs.get(sizeKey);
  const existing = running && jobs.get(running);
  if (existing && !isTerminal(existing.status)) return existing;

  const job = redrawJob(chart, [item]);
  item.detailJobs.set(sizeKey, job.id);
  const target = { kind: "detail", size, revision: item.revision } as const;
  (async () => {
    const data = await itemData(chart);
    await renderItems(job, data, [item], target);
    job.status = finalStatus(job);
  })()
    .catch((err) => {
      const reason = reasonOf(err);
      if (!reason) console.error(`detail job ${job.id} failed`, err);
      job.error = reason ?? REDRAW_FAILED;
      failItems(job, [item], job.error);
      job.status = "failed";
    })
    .finally(() => {
      job.timing.endedAt = Date.now();
      if (item.detailJobs.get(sizeKey) === job.id)
        item.detailJobs.delete(sizeKey);
      touch(job);
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
    ...itemView(chart, item),
  };
}

/** 그린 결과와 item 조작 상태. 다시 그릴 때마다 job의 item 상태에 그대로 옮긴다. */
function itemView(chart: ChartRecord, item: ChartItem) {
  return {
    image: item.image,
    thumbnail: item.thumbnail,
    revision: item.revision,
    zoomed: item.view !== undefined,
    shapeCount: item.shapes.length,
    color: itemColor(chart, item),
    customColor: hasCustomColor(item),
    legendPosition: item.props?.legendPosition,
    options: item.props?.options,
    selectedCount: item.selection ? item.selectedCount : undefined,
    favorites: item.favorites,
    legendGroups: item.legendGroups.map((g) => ({
      name: g.name,
      color: groupColor(item, g),
    })),
    deletionCount: item.deletions.length,
  } satisfies Partial<ItemState>;
}

/** 지정한 개별 속성이 하나도 없으면 undefined (공통 속성을 따른다) */
export function propsOrNone(props: ItemProps): ItemProps | undefined {
  return props.color ||
    props.legendColors ||
    props.legendPosition ||
    props.hiddenLegend?.length ||
    props.options
    ? props
    : undefined;
}

/** legend 위치: item 개별 → 공통 → 위 */
function legendPosition(chart: ChartRecord, item: ChartItem) {
  return (
    item.props?.legendPosition ??
    chart.spec.common.legendPosition ??
    CHART_FIELDS[chart.spec.chartType].legendPosition ??
    "top"
  );
}

/** 개별 색이 있으면 그 색, 없으면 공통 색 */
export function itemColor(chart: ChartRecord, item: ChartItem) {
  return item.props?.color ?? chart.spec.common.color;
}

/** item에 적용할 차트 속성 (기본값 → 공통 → 개별) */
function optionsFor(chart: ChartRecord, item: ChartItem) {
  return resolveOptions(
    chart.spec.chartType,
    chart.spec.common.options,
    item.props?.options,
  );
}

/**
 * legend 값별 색: item 개별 색 → 공통 속성의 legend 색 → 기본 색 순서로 고른다.
 * 기본 색은 palette.gradient가 켜져 있으면 값 순서대로 그라데이션 단계, 아니면 차트가 정한 색이나 팔레트 순서다.
 */
export function legendColors(
  chart: ChartRecord,
  item: ChartItem,
  values: string[],
  /** 차트가 정한 기본 색 (candle의 상승/하락). 없으면 팔레트 순서 */
  defaults?: readonly string[],
) {
  const { palette } = optionsFor(chart, item);
  const gradient = palette.gradient
    ? gradientColors(palette, values.length)
    : undefined;
  return values.map(
    (v, i) =>
      item.props?.legendColors?.[v] ??
      chart.spec.common.legendColors?.[v] ??
      gradient?.[i] ??
      defaults?.[i] ??
      defaultLegendColor(i),
  );
}

/** 새 범례 색: legend 색을 바꿨으면 그 색, 아니면 만들 때 정한 색 */
export function groupColor(
  item: ChartItem,
  group: { name: string; color: string },
) {
  return item.props?.legendColors?.[group.name] ?? group.color;
}

/**
 * legend 입력. 새 범례가 있으면 원래 legend 뒤에 덧붙이고, 원래 legend가 없으면
 * 나머지 점을 '기타' 하나로 둔다. legend도 새 범례도 없으면 undefined.
 */
function legendInput(
  chart: ChartRecord,
  item: ChartItem,
  title: string,
  values: string[] | undefined,
  defaults?: readonly string[],
) {
  const groups = item.legendGroups;
  if (!values && groups.length === 0) return undefined;
  return {
    title: values ? title : "범례",
    values: [...(values ?? [OTHERS_LABEL]), ...groups.map((g) => g.name)],
    colors: [
      ...(values
        ? legendColors(chart, item, values, defaults)
        : [item.props?.legendColors?.[OTHERS_LABEL] ?? itemColor(chart, item)]),
      ...groups.map((g) => groupColor(item, g)),
    ],
    position: legendPosition(chart, item),
    hidden: item.props?.hiddenLegend,
    style: legendStyleOf(optionsFor(chart, item)),
  };
}

/**
 * pie 조각 색. 색 순서(colorOrder)가 있으면 그 순서로 legend 색을 골라 item끼리 같은 범주가 같은 색이 되고,
 * 없으면 item 안의 조각 순서대로 고른다. '기타'는 따로 정한 색이 없으면 회색이다.
 */
function pieColors(
  chart: ChartRecord,
  item: ChartItem,
  data: PieData,
  values: string[],
) {
  const order = data.colorOrder ?? values.filter((v) => v !== OTHERS_SLICE);
  const named = legendColors(chart, item, order);
  return values.map((v) => {
    const i = v === OTHERS_SLICE ? -1 : order.indexOf(v);
    if (i >= 0) return named[i];
    return (
      item.props?.legendColors?.[v] ??
      chart.spec.common.legendColors?.[v] ??
      OTHERS_COLOR
    );
  });
}

/** 새 범례만 있을 때 나머지 점의 legend 이름 */
export const OTHERS_LABEL = "기타";

/** 개별 색이나 legend 개별 색을 하나라도 지정했는지 */
export function hasCustomColor(item: ChartItem) {
  return (
    item.props?.color !== undefined ||
    Object.keys(item.props?.legendColors ?? {}).length > 0
  );
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
/**
 * item·크게 보기 job의 데이터. 캐시에서 밀려나 다시 조회해야 하면, 데이터셋이 남아 있는지 data 서비스에
 * 먼저 묻는다. 지운 데이터면 404(DataServiceError)로 끝나 사유를 가를 수 있다.
 */
async function itemData(chart: ChartRecord) {
  if (!getCachedChartData(chart.id))
    await dataService.schema(chart.spec.dataset);
  return loadChartData(chart);
}

/** 차트 종류에 맞는 데이터를 조회한다. 새 차트는 여기에 분기 하나를 더한다. */
async function queryChartData(
  spec: ChartRecord["spec"],
): Promise<CachedChartData> {
  const { db } = getRuntime();
  const groupOf = new Map<string, number>();
  // 행 단위 점 차트(scatter, line)는 같은 원자료를 쓴다.
  if (POINT_CHARTS.includes(spec.chartType)) {
    return {
      kind: "scatter",
      ...(await db.call("chartData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        splitBy: spec.splitBy,
        legend: spec.legend,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "heatmap") {
    return {
      kind: "heatmap",
      ...(await db.call("heatmapData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        z: spec.z ?? "",
        agg: spec.agg,
        splitBy: spec.splitBy,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "histogram") {
    return {
      kind: "histogram",
      ...(await db.call("histogramData", {
        dataset: spec.dataset,
        x: spec.x,
        splitBy: spec.splitBy,
        legend: spec.legend,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "candle") {
    return {
      kind: "candle",
      ...(await db.call("candleData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        splitBy: spec.splitBy,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "gantt") {
    return {
      kind: "gantt",
      ...(await db.call("ganttData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        splitBy: spec.splitBy,
        legend: spec.legend,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "sankey") {
    return {
      kind: "sankey",
      ...(await db.call("sankeyData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        z: spec.z ?? "",
        agg: spec.agg,
        splitBy: spec.splitBy,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "pie") {
    // 조각 범주가 곧 legend라 spec.legend는 쓰지 않는다.
    return {
      kind: "pie",
      ...(await db.call("pieData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        agg: spec.agg,
        splitBy: spec.splitBy,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  if (spec.chartType === "radar") {
    return {
      kind: "radar",
      ...(await db.call("radarData", {
        dataset: spec.dataset,
        x: spec.x,
        y: spec.y,
        agg: spec.agg,
        splitBy: spec.splitBy,
        legend: spec.legend,
        filters: spec.filters,
      })),
      groupOf,
    };
  }
  return {
    kind: "category",
    ...(await db.call("categoryData", {
      dataset: spec.dataset,
      // treemap·waterfall은 bar와 같은 범주 × legend 값 집계를 쓴다.
      chartType:
        spec.chartType === "boxplot" || spec.chartType === "funnel"
          ? spec.chartType
          : "bar",
      x: spec.x,
      y: spec.y,
      agg: spec.agg,
      splitBy: spec.splitBy,
      // legend를 스스로 그리는 차트(waterfall)는 spec에 남은 legend 컬럼을 쓰지 않는다.
      legend: legendColumnOf(spec),
      filters: spec.filters,
    })),
    groupOf,
  };
}

async function loadChartData(chart: ChartRecord): Promise<CachedChartData> {
  const cached = getCachedChartData(chart.id);
  if (cached) return cached;
  const result = await queryChartData(chart.spec);
  result.groups.forEach((g, i) => {
    result.groupOf.set(itemKeyOf(g.values), i);
  });
  cacheChartData(chart.id, result);
  return result;
}

type RenderOutput = { png: ArrayBuffer; thumb?: ArrayBuffer; meta: ItemMeta };

/** 차트 종류에 맞는 렌더러를 골라 item 하나를 그린다. */
function renderItem(
  chart: ChartRecord,
  data: CachedChartData,
  item: ChartItem,
  size: ItemSize,
  thumbnail: boolean,
  poolOptions: PoolCallOptions<
    | "renderScatter"
    | "renderCategory"
    | "renderSankey"
    | "renderHeatmap"
    | "renderTreemap"
    | "renderCandle"
    | "renderGantt"
    | "renderPie"
    | "renderRadar"
    | "renderHistogram"
    | "renderWaterfall"
    | "renderFunnel"
  >,
): Promise<RenderOutput> {
  const { render } = getRuntime();
  const { spec } = chart;
  const index = data.groupOf.get(item.key);
  const columnOf = (name: string | null) =>
    chart.columns?.find((c) => c.name === name);
  const legendTitle = columnOf(spec.legend)?.label ?? spec.legend ?? "";
  // 기본값 → 공통 → 개별 순으로 합친 차트 속성. 차트가 쓰지 않는 구역은 기본값이다.
  const options = resolveOptions(
    spec.chartType,
    spec.common.options,
    item.props?.options,
  );
  const common = {
    options,
    width: size.width,
    height: size.height,
    thumbnail: thumbnail ? THUMBNAIL_SIZE : undefined,
    title: item.label,
    color: itemColor(chart, item),
    view: item.view,
    shapes: item.shapes,
    selection: item.selection,
    groups: item.legendGroups.map((g) => g.region),
  };
  if (data.kind === "scatter") {
    const group =
      index === undefined ? { start: 0, end: 0 } : data.groups[index];
    const legend = legendInput(chart, item, legendTitle, data.legend?.values);
    return render.call(
      "renderScatter",
      {
        ...common,
        chartType: spec.chartType === "line" ? "line" : "scatter",
        xTitle: columnOf(spec.x)?.label ?? spec.x,
        yTitle: columnOf(spec.y)?.label ?? spec.y,
        xKind: columnOf(spec.x)?.type === "datetime" ? "time" : "number",
        xs: data.xs.slice(group.start, group.end),
        ys: data.ys.slice(group.start, group.end),
        ids: data.ids.slice(group.start, group.end),
        deletions: item.deletions,
        legend: legend && {
          ...legend,
          // legend 컬럼이 없으면 모든 점이 '기타'(0)에서 출발한다.
          index:
            data.legend?.index.slice(group.start, group.end) ??
            new Uint8Array(group.end - group.start),
        },
      },
      poolOptions,
    );
  }
  if (data.kind === "pie") {
    const slices = index === undefined ? [] : data.groups[index].slices;
    const values = slices.map((s) => s.category);
    return render.call(
      "renderPie",
      {
        options,
        width: size.width,
        height: size.height,
        thumbnail: common.thumbnail,
        title: item.label,
        selection: item.selection,
        slices,
        agg: spec.agg,
        // 조각 범주가 곧 legend다 (spec.legend는 쓰지 않는다).
        legend: {
          title: columnOf(spec.x)?.label ?? spec.x,
          values,
          colors: pieColors(chart, item, data, values),
          position: legendPosition(chart, item),
          hidden: item.props?.hiddenLegend,
          style: legendStyleOf(options),
        },
      },
      poolOptions,
    );
  }
  if (data.kind === "radar") {
    const group = index === undefined ? undefined : data.groups[index];
    const values = data.legendValues;
    return render.call(
      "renderRadar",
      {
        options,
        width: size.width,
        height: size.height,
        thumbnail: common.thumbnail,
        title: item.label,
        selection: item.selection,
        color: common.color,
        axisTitle: columnOf(spec.x)?.label ?? spec.x,
        seriesName: columnOf(spec.y)?.label ?? spec.y,
        axes: group?.axes ?? [],
        cells: group?.cells ?? [],
        agg: spec.agg,
        // 새 범례(선택 영역 그룹)는 꼭짓점 색으로 칠하지 않아 legend에도 붙이지 않는다.
        legend: values && {
          title: legendTitle,
          values,
          colors: legendColors(chart, item, values),
          position: legendPosition(chart, item),
          hidden: item.props?.hiddenLegend,
          style: legendStyleOf(options),
        },
      },
      poolOptions,
    );
  }
  if (data.kind === "histogram") {
    const group = index === undefined ? undefined : data.groups[index];
    return render.call(
      "renderHistogram",
      {
        ...common,
        axisTitles: {
          x: columnOf(spec.x)?.label ?? spec.x,
          y: "개수",
        },
        bins: data.bins,
        counts: group?.counts ?? [],
        legend: legendInput(chart, item, legendTitle, data.legendValues),
      },
      poolOptions,
    );
  }
  if (data.kind === "candle") {
    const group = index === undefined ? undefined : data.groups[index];
    return render.call(
      "renderCandle",
      {
        ...common,
        interval: data.interval,
        candles: group ?? {
          t: [],
          open: [],
          high: [],
          low: [],
          close: [],
          count: [],
        },
        // 데이터 컬럼 대신 상승/하락 두 항목이 legend다.
        legend: legendInput(
          chart,
          item,
          CANDLE_LEGEND.title,
          [...CANDLE_LEGEND.values],
          CANDLE_LEGEND.colors,
        ) as NonNullable<ReturnType<typeof legendInput>>,
      },
      poolOptions,
    );
  }
  if (data.kind === "gantt") {
    const group = index === undefined ? undefined : data.groups[index];
    return render.call(
      "renderGantt",
      {
        ...common,
        rowTitle: columnOf(spec.y)?.label ?? spec.y,
        rows: group?.rows ?? [],
        bars: group?.bars ?? { r: [], s: [], e: [], g: [], n: [] },
        legend: legendInput(chart, item, legendTitle, data.legendValues),
      },
      poolOptions,
    );
  }
  if (data.kind === "sankey") {
    const group = index === undefined ? undefined : data.groups[index];
    // legend는 출발 노드(x 값)다. 체크박스로 끈 노드의 흐름은 빼고 배치한다.
    const legend = legendInput(
      chart,
      item,
      columnOf(spec.x)?.label ?? spec.x,
      data.sources,
    ) as NonNullable<ReturnType<typeof legendInput>>;
    return render.call(
      "renderSankey",
      {
        options,
        width: common.width,
        height: common.height,
        thumbnail: common.thumbnail,
        title: common.title,
        shapes: common.shapes,
        selection: common.selection,
        sources: data.sources,
        targets: data.targets,
        links: group?.links ?? [],
        agg: spec.agg,
        legend,
      },
      poolOptions,
    );
  }
  if (data.kind === "heatmap") {
    const group = index === undefined ? undefined : data.groups[index];
    // legend 컬럼은 쓰지 않는다. 선택 영역으로 만든 새 범례만 legend 상자에 둔다.
    const groups = item.legendGroups;
    return render.call(
      "renderHeatmap",
      {
        ...common,
        xTitle: columnOf(spec.x)?.label ?? spec.x,
        yTitle: columnOf(spec.y)?.label ?? spec.y,
        xCategories: group?.xCategories ?? [],
        xStarts: group?.xStarts,
        timeBin: data.timeBin,
        yCategories: group?.yCategories ?? [],
        cells: group?.cells ?? [],
        agg: spec.agg,
        legend:
          groups.length > 0
            ? {
                title: "범례",
                values: groups.map((g) => g.name),
                colors: groups.map((g) => groupColor(item, g)),
                position: legendPosition(chart, item),
                style: legendStyleOf(options),
              }
            : undefined,
      },
      poolOptions,
    );
  }
  const group = index === undefined ? undefined : data.groups[index];
  if (spec.chartType === "funnel") {
    // 단계가 곧 legend 값이다. 단계 순서(값 큰 순)대로 팔레트 색을 받는다.
    const stages = group?.categories ?? [];
    return render.call(
      "renderFunnel",
      {
        ...common,
        stages,
        values: group?.bars?.map((row) => row[0]) ?? [],
        agg: spec.agg,
        legend: legendInput(
          chart,
          item,
          columnOf(spec.x)?.label ?? spec.x,
          stages,
        ),
      },
      poolOptions,
    );
  }
  if (spec.chartType === "waterfall") {
    return render.call(
      "renderWaterfall",
      {
        ...common,
        axisTitles: {
          x: columnOf(spec.x)?.label ?? spec.x,
          y: columnOf(spec.y)?.label ?? spec.y,
        },
        categories: group?.categories ?? [],
        values: group?.bars?.map((row) => row[0]) ?? [],
        agg: spec.agg,
        legend: legendInput(
          chart,
          item,
          "구분",
          [...WATERFALL_KINDS],
          waterfallDefaultColors(common.color),
        ),
      },
      poolOptions,
    );
  }
  if (spec.chartType === "treemap") {
    // 새 범례(선택 영역)는 treemap에 쓰지 않는다. legend 값이 곧 부모 묶음이다.
    return render.call(
      "renderTreemap",
      {
        ...common,
        categories: group?.categories ?? [],
        bars: group?.bars,
        agg: spec.agg,
        legend: legendInput(
          chart,
          { ...item, legendGroups: [] },
          legendTitle,
          data.legendValues,
        ),
      },
      poolOptions,
    );
  }
  return render.call(
    "renderCategory",
    {
      ...common,
      axisTitles: {
        x: columnOf(spec.x)?.label ?? spec.x,
        y: columnOf(spec.y)?.label ?? spec.y,
      },
      chartType: spec.chartType === "bar" ? "bar" : "boxplot",
      categories: group?.categories ?? [],
      bars: group?.bars,
      boxes: group?.boxes,
      agg: spec.chartType === "bar" ? spec.agg : undefined,
      legend: legendInput(chart, item, legendTitle, data.legendValues),
    },
    poolOptions,
  );
}

/** item들을 pool에 순서대로 넣는다. 순서를 당기는 우선순위는 두지 않는다. */
async function renderItems(
  job: Job,
  data: CachedChartData,
  items: ChartItem[],
  target: RenderTarget,
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
      const size = target.kind === "detail" ? target.size : chart.itemSize;
      const thumbnail = target.kind === "item" && target.thumbnail;
      return renderItem(chart, data, item, size, thumbnail, {
        signal,
        onStart: () => {
          state.status = "running";
          setStage("aggregate", 0);
        },
        onProgress: (p) => setStage(p.stage, p.ratio),
      })
        .then(async (result) => {
          if (target.kind === "detail") {
            // 그리는 사이 내용이 바뀌었으면 예전 그림이므로 버린다. 화면은 새 revision으로 다시 요청한다.
            if (item.revision !== target.revision) {
              state.status = "cancelled";
              return;
            }
            state.image = await storeDetail(chart, item, size, result);
            state.status = "success";
            return;
          }
          await storeResult(chart, item, result);
          item.meta = result.meta;
          item.selectedCount = result.meta.selected;
          if (!item.view) {
            item.fullView = {
              x: result.meta.x.domain,
              y: result.meta.y.domain,
            };
          }
          Object.assign(state, itemView(chart, item));
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
  Object.assign(state, itemView(chart, item));
  touch(primary);
}

async function storeResult(
  chart: ChartRecord,
  item: ChartItem,
  { png, thumb }: RenderOutput,
) {
  item.version++;
  const url = pngUrl(chart.id, item);
  await putPng(new URL(url, location.origin).href, png);
  item.image = {
    url,
    width: chart.itemSize.width,
    height: chart.itemSize.height,
  };
  if (thumb) {
    const thumbUrl = thumbnailUrl(chart.id, item);
    await putPng(new URL(thumbUrl, location.origin).href, thumb);
    item.thumbnail = { url: thumbUrl, ...THUMBNAIL_SIZE };
  }
}

/** 상세 PNG를 크기별 캐시에 넣는다. 밀려난 크기의 PNG는 지운다. */
async function storeDetail(
  chart: ChartRecord,
  item: ChartItem,
  size: ItemSize,
  { png, meta }: RenderOutput,
) {
  const url = detailUrl(chart.id, item, size);
  await putPng(new URL(url, location.origin).href, png);
  const image = { url, ...size };
  await deletePngs(putDetail(item, size, { image, meta }));
  return image;
}
