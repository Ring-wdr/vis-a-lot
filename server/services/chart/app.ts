// chart 서비스: 그리기 job, item 조작, 툴팁, PNG, history.
// 요청 형식은 routes의 zod 스키마가 검증하고, 여기서는 필드 사이의 규칙과 상태만 확인한다.

import type { Context } from "hono";
import type { ChartSpec } from "../../api/types";
import { isTerminal } from "../../api/types";
import { createChart, getChart, getItem } from "../../charts/chart-store";
import { zoomIn, zoomOut } from "../../charts/item-view";
import { COLUMNS } from "../../data/schema";
import { attachHistory, recordEvent } from "../../history/recorder";
import {
  cancelJob as cancel,
  getJob,
  type ItemSelection,
  startItemJob,
  startJob,
  jobState as stateOf,
  waitForUpdate,
} from "../../jobs/job-manager";
import { matchPng, putPng } from "../../png-store";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";

const LONG_POLL_TIMEOUT_MS = 25_000;
const COLUMN_TYPE = new Map<string, string>(
  COLUMNS.map((c) => [c.name, c.type]),
);

let pngVersion = 0;

function roundSize(size: { width: number; height: number }) {
  return { width: Math.round(size.width), height: Math.round(size.height) };
}

/** 컬럼 타입에 따른 축 규칙. 스키마만으로는 표현하기 어려운 필드 사이 규칙이다. */
function axisError(spec: ChartSpec): string | undefined {
  if (spec.chartType === "scatter") {
    for (const axis of [spec.x, spec.y]) {
      const type = COLUMN_TYPE.get(axis);
      if (type !== "number" && type !== "time")
        return `${axis} cannot be a scatter axis`;
    }
    return;
  }
  // bar / boxplot: x는 범주(문자) 컬럼, y는 숫자 컬럼
  if (COLUMN_TYPE.get(spec.x) !== "string")
    return `${spec.x} is not categorical`;
  if (COLUMN_TYPE.get(spec.y) !== "number") return `${spec.y} is not numeric`;
  if (new Set(spec.splitBy).size !== spec.splitBy.length)
    return "duplicate splitBy column";
}

type Rejected = { status: 404 | 409; error: string };
type Chart = NonNullable<ReturnType<typeof getChart>>;
type Item = NonNullable<ReturnType<typeof getItem>>;

/** item 단위 조작의 공통 전처리. 아직 그려지지 않았거나 다시 그리는 중이면 거절한다. */
function editableItem(
  chartId: string,
  itemKey: string,
): Rejected | { chart: Chart; item: Item } {
  const chart = getChart(chartId);
  const item = chart && getItem(chart, itemKey);
  if (!chart || !item) return { status: 404, error: "unknown item" };
  if (!item.image) return { status: 409, error: "item is not drawn yet" };
  if (item.busyJobId) return { status: 409, error: "item is being redrawn" };
  return { chart, item };
}

/** 전체를 다시 그리는 변경(공통 속성, grid)은 차트가 다 그려지고 쉬고 있을 때만 받는다. */
function idleChart(
  chartId: string,
): Rejected | { chart: Chart; items: Item[] } {
  const chart = getChart(chartId);
  if (!chart) return { status: 404, error: "unknown chart" };
  const primary = chart.primaryJobId ? getJob(chart.primaryJobId) : undefined;
  if (!chart.items || (primary && !isTerminal(primary.status))) {
    return { status: 409, error: "렌더링 중에는 바꿀 수 없습니다." };
  }
  if (chart.items.some((i) => i.busyJobId)) {
    return { status: 409, error: "다시 그리는 중인 item이 있습니다." };
  }
  return { chart, items: chart.items };
}

function reject(c: Context, { status, error }: Rejected) {
  return status === 404 ? apiError(c, 404, error) : apiError(c, 409, error);
}

function redrawJob(
  chart: Chart,
  keys: string[],
  options?: Parameters<typeof startItemJob>[2],
) {
  return { jobId: startItemJob(chart, keys, options).id };
}

export const chartApp = createServiceApp()
  .openapi(routes.createChart, async (c) => {
    const body = c.req.valid("json");
    const invalid = axisError(body.spec);
    if (invalid) return apiError(c, 400, invalid);
    const chart = createChart(
      body.spec,
      roundSize(body.itemSize),
      body.restore,
    );
    // draw마다 history 한 건. history에서 불러온 차트면 그 건에 이어서 기록한다.
    // 다시 보기(record: false)는 기록하지 않아 history 목록 순서와 썸네일이 그대로다.
    if (body.record !== false) await attachHistory(chart, body.historyId);
    const job = startJob(chart);
    return c.json(
      { chartId: chart.id, jobId: job.id, historyId: chart.history?.id ?? "" },
      202,
    );
  })
  .openapi(routes.jobState, async (c) => {
    const job = getJob(c.req.valid("param").jobId);
    if (!job) return apiError(c, 404, "unknown job");
    const query = c.req.valid("query");
    const keys = query.items?.split(",").filter(Boolean);
    const selection: ItemSelection = keys
      ? { keys }
      : { page: query.page, pageSize: query.pageSize };
    await waitForUpdate(job, query.since, selection, LONG_POLL_TIMEOUT_MS);
    return c.json(stateOf(job, selection), 200);
  })
  .openapi(routes.cancelJob, (c) => {
    const job = getJob(c.req.valid("param").jobId);
    if (!job) return apiError(c, 404, "unknown job");
    cancel(job);
    return c.body(null, 202);
  })
  .openapi(routes.changeView, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    const body = c.req.valid("json");
    if (body.type === "zoomIn") {
      const view = zoomIn(body.x, body.y);
      if (!view) return apiError(c, 400, "empty range");
      item.view = view;
    } else if (body.type === "zoomOut") {
      if (!item.view) return apiError(c, 409, "item is not zoomed");
      item.view = zoomOut(item.view, item.fullView, body.ratio);
    } else {
      item.view = undefined;
    }
    recordEvent(chart, "zoom", item.key);
    return c.json(redrawJob(chart, [item.key]), 202);
  })
  .openapi(routes.addShape, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    target.item.shapes.push(c.req.valid("json").shape);
    recordEvent(target.chart, "shape", target.item.key);
    return c.json(redrawJob(target.chart, [target.item.key]), 202);
  })
  // undo: 마지막 도형을 뺀다. undo 이력 자체는 화면 세션 안에서만 의미가 있다.
  .openapi(routes.undoShape, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    if (target.item.shapes.length === 0) return apiError(c, 409, "no shapes");
    target.item.shapes.pop();
    recordEvent(target.chart, "undo", target.item.key);
    return c.json(redrawJob(target.chart, [target.item.key]), 202);
  })
  .openapi(routes.clearShapes, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    if (target.item.shapes.length === 0) return apiError(c, 409, "no shapes");
    target.item.shapes = [];
    recordEvent(target.chart, "clearShapes", target.item.key);
    return c.json(redrawJob(target.chart, [target.item.key]), 202);
  })
  .openapi(routes.changeItemProps, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    const body = c.req.valid("json");
    const props = { ...item.props };
    if ("legendColor" in body) {
      // legend 값 하나의 개별 색. null이면 공통 속성을 따르도록 되돌린다.
      const { value, color } = body.legendColor;
      const legendColors = { ...props.legendColors };
      if (color === null) delete legendColors[value];
      else legendColors[value] = color;
      props.legendColors = Object.keys(legendColors).length
        ? legendColors
        : undefined;
    } else {
      props.color = body.color ?? undefined;
    }
    item.props = props.color || props.legendColors ? props : undefined;
    recordEvent(target.chart, "color", item.key);
    return c.json(redrawJob(target.chart, [item.key]), 202);
  })
  // 공통 속성 변경: 개별 속성을 모두 덮어쓰고, 다시 조회하지 않고 전체를 다시 그린다.
  .openapi(routes.changeCommon, (c) => {
    const target = idleChart(c.req.valid("param").chartId);
    if ("error" in target) return reject(c, target);
    const { chart, items } = target;
    chart.spec = { ...chart.spec, common: { ...c.req.valid("json").common } };
    for (const item of items) item.props = undefined;
    recordEvent(chart, "common");
    return c.json(
      redrawJob(
        chart,
        items.map((i) => i.key),
        { primary: true },
      ),
      202,
    );
  })
  // grid 크기 변경: item 크기가 바뀌므로 draw 없이 바로 전체를 다시 그린다.
  .openapi(routes.changeGrid, (c) => {
    const { grid, itemSize } = c.req.valid("json");
    const target = idleChart(c.req.valid("param").chartId);
    if ("error" in target) return reject(c, target);
    const { chart, items } = target;
    chart.spec = { ...chart.spec, grid: { rows: grid.rows, cols: grid.cols } };
    chart.itemSize = roundSize(itemSize);
    recordEvent(chart, "grid");
    return c.json(
      redrawJob(
        chart,
        items.map((i) => i.key),
        { primary: true },
      ),
      202,
    );
  })
  // 화면 크기 변경: 요청한 item(현재 페이지)만 새 크기로 다시 그린다. history에는 남기지 않는다.
  .openapi(routes.resize, (c) => {
    const chart = getChart(c.req.valid("param").chartId);
    if (!chart?.items) return apiError(c, 404, "unknown chart");
    const body = c.req.valid("json");
    const keys = new Set(body.keys);
    const targets = chart.items.filter(
      (i) => keys.has(i.key) && i.image && !i.busyJobId,
    );
    if (targets.length === 0) return apiError(c, 409, "no item to resize");
    chart.itemSize = roundSize(body.itemSize);
    return c.json(
      redrawJob(
        chart,
        targets.map((i) => i.key),
        { record: false },
      ),
      202,
    );
  })
  // 툴팁용 metadata. 화면이 item에 처음 커서를 올릴 때 받아 캐시한다.
  .openapi(routes.itemMeta, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const item = getChart(chartId)?.items?.find((i) => i.key === itemKey);
    if (!item?.meta) return apiError(c, 404, "metadata is not ready");
    return c.json(item.meta, 200);
  })
  // x, y 외의 툴팁 컬럼은 행 식별자로 조회한다 (조회는 chart 서비스가 DB를 직접 읽는다).
  .openapi(routes.tooltip, async (c) => {
    const chart = getChart(c.req.valid("param").chartId);
    if (!chart) return apiError(c, 404, "unknown chart");
    const { rowId, columns } = c.req.valid("json");
    const values = await getRuntime().db.call("rowValues", {
      rows: chart.spec.rows,
      rowId,
      columns,
    });
    return c.json({ values }, 200);
  })
  // `<img src>` 요청도 service worker를 거쳐 여기로 온다.
  .openapi(routes.png, async (c) => {
    const cached = await matchPng(c.req.url);
    if (!cached) return c.body(null, 404);
    return c.body(await cached.arrayBuffer(), 200, {
      "content-type": "image/png",
    });
  })
  .openapi(routes.historyList, async (c) => {
    const entries = await getRuntime().db.call("historyList", undefined);
    return c.json({ entries }, 200);
  })
  .openapi(routes.historyDetail, async (c) => {
    const entry = await getRuntime().db.call("historyGet", {
      id: c.req.valid("param").id,
    });
    if (!entry) return apiError(c, 404, "unknown history");
    return c.json(entry, 200);
  })
  .openapi(routes.health, (c) =>
    c.json(
      { service: "chart" as const, renderWorkers: getRuntime().render.size },
      200,
    ),
  )
  // 1단계 검증용 렌더 (/dev 페이지).
  .openapi(routes.debugRender, async (c) => {
    const body = c.req.valid("json");
    const result = await getRuntime().render.call("renderTest", {
      width: body.width,
      height: body.height,
      label: body.itemKey,
      points: body.points,
    });
    const url = `/api/chart/charts/${encodeURIComponent(body.chartId)}/items/${encodeURIComponent(body.itemKey)}/png?v=${++pngVersion}`;
    await putPng(new URL(url, location.origin).href, result.png);
    return c.json(
      {
        url,
        width: body.width,
        height: body.height,
        worker: result.worker,
        renderMs: result.ms,
      },
      200,
    );
  });
