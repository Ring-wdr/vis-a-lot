// chart 서비스: 그리기 job, item 조작, 툴팁, PNG, history, 공유.
// 요청 형식은 routes의 zod 스키마가 검증하고, 여기서는 필드 사이의 규칙과 상태만 확인한다.

import type { Context } from "hono";
import { type ItemSize, isTerminal } from "../../api/types";
import { CHART_DEFAULTS } from "../../charts/chart-defaults";
import { canDelete } from "../../charts/chart-fields";
import { pickSupported } from "../../charts/chart-options";
import {
  createChart,
  getChart,
  getDetail,
  getItem,
} from "../../charts/chart-store";
import {
  applyItemChanges,
  type ItemPropChanges,
  propsOrNone,
} from "../../charts/item-props";
import { chartRestore } from "../../charts/item-restore";
import { itemRowsScope, scopeSelected } from "../../charts/item-scope";
import { pan, zoomIn, zoomOut } from "../../charts/item-view";
import { attachHistory, recordEvent } from "../../history/recorder";
import {
  cancelJob as cancel,
  getJob,
  type ItemSelection,
  OTHERS_LABEL,
  startDetailJob,
  startItemJob,
  startJob,
  jobState as stateOf,
  waitForUpdate,
} from "../../jobs/job-manager";
import { matchPng, putPng } from "../../png-store";
import { defaultLegendColor } from "../../render/theme";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";

const LONG_POLL_TIMEOUT_MS = 25_000;
const MAX_FAVORITES = 20;
const MAX_LEGEND_GROUPS = 8;
const MAX_DELETIONS = 50;
/** 이보다 촘촘한 화면도 이 배율로 그린다. PNG 픽셀 수가 배율의 제곱으로 늘기 때문이다. */
const MAX_PIXEL_RATIO = 3;

let pngVersion = 0;

/** 크기는 정수 픽셀로, 배율은 1~3에서 0.25 단위로 맞춘다 (배율이 조금씩 다른 요청이 캐시를 나누지 않게). */
function roundSize(size: ItemSize): ItemSize {
  const ratio = Math.min(
    MAX_PIXEL_RATIO,
    Math.max(1, Math.round((size.pixelRatio ?? 1) * 4) / 4),
  );
  return {
    width: Math.round(size.width),
    height: Math.round(size.height),
    ...(ratio > 1 ? { pixelRatio: ratio } : {}),
  };
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

/** 행 조회용 item. 다시 그리는 중이어도 된다 (조건은 서버에 저장된 상태로 정해진다). */
function drawnItem({
  chartId,
  itemKey,
}: {
  chartId: string;
  itemKey: string;
}): Rejected | { chart: Chart; item: Item } {
  const chart = getChart(chartId);
  const item = chart && getItem(chart, itemKey);
  if (!chart || !item) return { status: 404, error: "unknown item" };
  if (!item.image) return { status: 409, error: "item is not drawn yet" };
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
    // 컬럼과 타입은 데이터셋마다 달라 job이 데이터 준비 뒤 스키마로 확인한다.
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
      : { page: query.page, pageSize: query.pageSize, offset: query.offset };
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
    } else if (body.type === "pan") {
      const base = item.view ?? item.fullView;
      if (!base) return apiError(c, 409, "item has no range yet");
      const view = pan(base, body.dx, body.dy);
      if (!view) return apiError(c, 400, "empty move");
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
  .openapi(routes.addDeletion, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    // bar/boxplot 같은 집계 차트는 점이 아니라 집계 값이라 지울 대상이 없다.
    if (!canDelete(chart.spec))
      return apiError(c, 409, "점 삭제는 점을 그리는 차트에서만 됩니다.");
    if (item.deletions.length >= MAX_DELETIONS)
      return apiError(
        c,
        409,
        `삭제는 ${MAX_DELETIONS}번까지 쌓을 수 있습니다.`,
      );
    item.deletions = [...item.deletions, c.req.valid("json").region];
    recordEvent(chart, "delete", item.key);
    return c.json(redrawJob(chart, [item.key]), 202);
  })
  .openapi(routes.undoDeletion, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    if (item.deletions.length === 0) return apiError(c, 409, "no deletions");
    item.deletions = item.deletions.slice(0, -1);
    recordEvent(target.chart, "delete", item.key);
    return c.json(redrawJob(target.chart, [item.key]), 202);
  })
  .openapi(routes.clearDeletions, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    if (item.deletions.length === 0) return apiError(c, 409, "no deletions");
    item.deletions = [];
    recordEvent(target.chart, "delete", item.key);
    return c.json(redrawJob(target.chart, [item.key]), 202);
  })
  .openapi(routes.setSelection, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { region } = c.req.valid("json");
    if (!region && !target.item.selection)
      return apiError(c, 409, "nothing is selected");
    target.item.selection = region ?? undefined;
    recordEvent(target.chart, "selection", target.item.key);
    return c.json(redrawJob(target.chart, [target.item.key]), 202);
  })
  .openapi(routes.addFavorite, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    const name = c.req.valid("json").name.trim();
    if (!item.selection) return apiError(c, 409, "선택한 영역이 없습니다.");
    if (item.favorites.some((f) => f.name === name))
      return apiError(c, 409, `'${name}' 즐겨찾기가 이미 있습니다.`);
    if (item.favorites.length >= MAX_FAVORITES)
      return apiError(c, 409, `즐겨찾기는 ${MAX_FAVORITES}개까지입니다.`);
    item.favorites = [...item.favorites, { name, region: item.selection }];
    recordEvent(target.chart, "favorite", item.key);
    // 그림은 그대로지만 item 상태(즐겨찾기 목록)를 같은 길로 돌려주려고 다시 그린다.
    return c.json(redrawJob(target.chart, [item.key], { content: false }), 202);
  })
  .openapi(routes.removeFavorite, (c) => {
    const { chartId, itemKey, name } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    if (!item.favorites.some((f) => f.name === name))
      return apiError(c, 404, "unknown favorite");
    item.favorites = item.favorites.filter((f) => f.name !== name);
    recordEvent(target.chart, "favorite", item.key);
    return c.json(redrawJob(target.chart, [item.key], { content: false }), 202);
  })
  .openapi(routes.addLegendGroup, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    const name = c.req.valid("json").name.trim();
    if (!item.selection) return apiError(c, 409, "선택한 영역이 없습니다.");
    // legend 항목 이름은 색을 찾는 키라 원래 legend 값과도 겹치면 안 된다.
    const taken = new Set([...(item.meta?.legend?.values ?? []), OTHERS_LABEL]);
    if (taken.has(name))
      return apiError(c, 409, `'${name}' legend 항목이 이미 있습니다.`);
    if (item.legendGroups.length >= MAX_LEGEND_GROUPS)
      return apiError(c, 409, `새 범례는 ${MAX_LEGEND_GROUPS}개까지입니다.`);
    const base =
      (item.meta?.legend?.values.length ?? 1) - item.legendGroups.length;
    item.legendGroups = [
      ...item.legendGroups,
      {
        name,
        color: defaultLegendColor(base + item.legendGroups.length),
        region: item.selection,
      },
    ];
    item.selection = undefined;
    recordEvent(chart, "legend", item.key);
    return c.json(redrawJob(chart, [item.key]), 202);
  })
  .openapi(routes.removeLegendGroup, (c) => {
    const { chartId, itemKey, name } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    if (!item.legendGroups.some((g) => g.name === name))
      return apiError(c, 404, "unknown legend group");
    item.legendGroups = item.legendGroups.filter((g) => g.name !== name);
    // 이 항목에 따로 정한 색도 함께 지운다.
    if (item.props?.legendColors?.[name]) {
      const { [name]: _removed, ...rest } = item.props.legendColors;
      item.props = propsOrNone({
        ...item.props,
        legendColors: Object.keys(rest).length ? rest : undefined,
      });
    }
    recordEvent(target.chart, "legend", item.key);
    return c.json(redrawJob(target.chart, [item.key]), 202);
  })
  .openapi(routes.changeItemProps, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { item } = target;
    const body = c.req.valid("json");
    // 한 가지씩 바꾸는 요청도 settings와 같은 모양으로 맞춰 한 곳에서 적용한다.
    const changes: ItemPropChanges =
      "settings" in body
        ? body.settings
        : "legendColor" in body
          ? {
              legendColors: {
                [body.legendColor.value]: body.legendColor.color,
              },
            }
          : body;
    item.props = applyItemChanges(
      item.props,
      changes,
      target.chart.spec.chartType,
    );
    recordEvent(
      target.chart,
      changes.options !== undefined
        ? "options"
        : changes.color !== undefined || changes.legendColors
          ? "color"
          : "legend",
      item.key,
    );
    return c.json(redrawJob(target.chart, [item.key]), 202);
  })
  // 공통 속성 변경: 개별 속성을 모두 덮어쓰고, 다시 조회하지 않고 전체를 다시 그린다.
  .openapi(routes.changeCommon, (c) => {
    const target = idleChart(c.req.valid("param").chartId);
    if ("error" in target) return reject(c, target);
    const { chart, items } = target;
    const common = c.req.valid("json").common;
    chart.spec = {
      ...chart.spec,
      common: {
        ...common,
        options: pickSupported(chart.spec.chartType, common.options),
      },
    };
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
    // 크기만 바뀌므로 섬네일과 크게 보기 PNG는 그대로 쓴다.
    return c.json(
      redrawJob(
        chart,
        items.map((i) => i.key),
        { primary: true, content: false },
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
        { record: false, content: false },
      ),
      202,
    );
  })
  // 크게 보기: 같은 내용·같은 크기로 그려 둔 PNG가 있으면 바로 주고, 없으면 그 한 장만 그린다.
  // 브라우저 크기가 바뀌어도 보이는 item 하나만 다시 그리므로 grid resize보다 부담이 작다.
  .openapi(routes.itemDetail, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const target = editableItem(chartId, itemKey);
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    const size = roundSize(c.req.valid("json").itemSize);
    const cached = getDetail(item, size);
    if (cached) return c.json({ image: cached.image }, 200);
    return c.json({ jobId: startDetailJob(chart, item, size).id }, 200);
  })
  // 툴팁용 metadata. 화면이 item에 처음 커서를 올릴 때 받아 캐시한다.
  .openapi(routes.itemMeta, (c) => {
    const { chartId, itemKey } = c.req.valid("param");
    const { size } = c.req.valid("query");
    const item = getChart(chartId)?.items?.find((i) => i.key === itemKey);
    const meta = size ? item?.details.get(size)?.meta : item?.meta;
    if (!meta) return apiError(c, 404, "metadata is not ready");
    return c.json(meta, 200);
  })
  // x, y 외의 툴팁 컬럼은 행 식별자로 조회한다 (조회는 chart 서비스가 DB를 직접 읽는다).
  .openapi(routes.tooltip, async (c) => {
    const chart = getChart(c.req.valid("param").chartId);
    if (!chart) return apiError(c, 404, "unknown chart");
    const { rowId, columns } = c.req.valid("json");
    const values = await getRuntime().db.call("rowValues", {
      dataset: chart.spec.dataset,
      rowId,
      columns,
    });
    if (!values) return apiError(c, 404, "unknown dataset");
    return c.json({ values }, 200);
  })
  // 데이터 표: item이 그린 행을 페이지 단위로. 선택 영역이 있으면 그 안의 행만 준다.
  .openapi(routes.itemRows, async (c) => {
    const target = drawnItem(c.req.valid("param"));
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    const scope = itemRowsScope(chart, item);
    const page = await getRuntime().db.call("itemRows", {
      dataset: chart.spec.dataset,
      scope,
      page: c.req.valid("json"),
    });
    if (!page) return apiError(c, 404, "unknown dataset");
    return c.json(
      {
        ...page,
        selected: scopeSelected(scope),
        filterCount: chart.spec.filters?.length ?? 0,
      },
      200,
    );
  })
  // 전체 데이터 표: 데이터셋 전체를 그 차트의 draw 시점 필터로 거른 샘플. 그린 item이 없어도 된다.
  .openapi(routes.sampleRows, async (c) => {
    const chart = getChart(c.req.valid("param").chartId);
    if (!chart) return apiError(c, 404, "unknown chart");
    const page = await getRuntime().db.call("sampleRows", {
      dataset: chart.spec.dataset,
      filters: chart.spec.filters,
      page: c.req.valid("json"),
    });
    if (!page) return apiError(c, 404, "unknown dataset");
    return c.json(
      { ...page, filterCount: chart.spec.filters?.length ?? 0 },
      200,
    );
  })
  .openapi(routes.exportItemRows, async (c) => {
    const target = drawnItem(c.req.valid("param"));
    if ("error" in target) return reject(c, target);
    const { chart, item } = target;
    const scope = itemRowsScope(chart, item);
    const csv = await getRuntime().db.call("exportItemRows", {
      dataset: chart.spec.dataset,
      scope,
    });
    if (!csv) return apiError(c, 404, "unknown dataset");
    // Excel이 한글 머리글을 UTF-8로 읽도록 BOM을 붙인다.
    const body = await new Blob(["\uFEFF", csv]).arrayBuffer();
    return c.body(body, 200, { "content-type": "text/csv; charset=utf-8" });
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
  // 공유: 지금 차트의 설정·item 상태와 대표 PNG를 고정한다. 이후 차트를 고쳐도 공유는 그대로다.
  .openapi(routes.createShare, async (c) => {
    const body = c.req.valid("json");
    const chart = getChart(body.chartId);
    if (!chart?.items) return apiError(c, 404, "unknown chart");
    const item = body.itemKey
      ? getItem(chart, body.itemKey)
      : chart.items.find((i) => i.image);
    if (body.itemKey && !item) return apiError(c, 404, "unknown item");
    if (!item?.image) return apiError(c, 409, "item is not drawn yet");
    const cached = await matchPng(
      new URL(item.image.url, location.origin).href,
    );
    if (!cached) return apiError(c, 409, "item is not drawn yet");
    const png = new Uint8Array(await cached.arrayBuffer());
    const share = await getRuntime().db.call(
      "shareSave",
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        createdBy: c.get("principal").sub,
        createdByName: c.get("principal").name,
        title: body.title,
        dataset: chart.spec.dataset,
        spec: chart.spec,
        restore: chartRestore(chart),
        item: { key: item.key, label: item.label },
        image: { width: item.image.width, height: item.image.height },
        png,
      },
      { transfer: [png.buffer] },
    );
    return c.json(share, 201);
  })
  .openapi(routes.listShares, async (c) => {
    const shares = await getRuntime().db.call("shareList", {
      createdBy: c.get("principal").sub,
    });
    return c.json({ shares }, 200);
  })
  .openapi(routes.getShare, async (c) => {
    const share = await getRuntime().db.call("shareGet", {
      id: c.req.valid("param").shareId,
    });
    if (!share) return apiError(c, 404, "unknown share");
    return c.json(share, 200);
  })
  .openapi(routes.sharePng, async (c) => {
    const png = await getRuntime().db.call("sharePng", {
      id: c.req.valid("param").shareId,
    });
    if (!png) return c.body(null, 404);
    return c.body(png.buffer as ArrayBuffer, 200, {
      "content-type": "image/png",
      // 스냅숏이라 내용이 바뀌지 않는다.
      "cache-control": "private, max-age=31536000, immutable",
    });
  })
  .openapi(routes.deleteShare, async (c) => {
    const deleted = await getRuntime().db.call("shareDelete", {
      id: c.req.valid("param").shareId,
      createdBy: c.get("principal").sub,
    });
    if (!deleted) return apiError(c, 404, "unknown share");
    return c.body(null, 204);
  })
  .openapi(routes.defaults, (c) => c.json(CHART_DEFAULTS, 200))
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
