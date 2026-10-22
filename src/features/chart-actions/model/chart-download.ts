// 차트 도구의 다운로드: 고른 item의 PNG와 데이터(CSV), 모든 item을 grid 배치로 넣은 엑셀(xlsx).

import { api } from "@/shared/api/api";
import type { ChartSpec, ItemState } from "@/shared/api/types";
import { safeFileName, saveBlob } from "@/shared/lib/save-file";

/** 엑셀 한 파일에 넣는 item 수 상한. 넘으면 앞에서부터 이만큼만 넣는다. */
export const MAX_EXCEL_ITEMS = 300;
/** job 상태를 한 번에 받는 item 수 (서버 pageSize 상한) */
const RANGE_SIZE = 100;

async function fetchPng(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PNG를 받지 못했습니다 (HTTP ${res.status}).`);
  return res.arrayBuffer();
}

/** 공통 속성이 바뀐 뒤 예전 그림(stale)인 item을 새로 그릴 때까지 기다리는 최대 시간 */
const FRESH_TIMEOUT_MS = 120_000;
const FRESH_POLL_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * item들의 지금 상태. 공통 속성이 바뀐 뒤 아직 예전 그림(stale)인 item은 새 설정으로 다시 그리게 하고
 * 끝날 때까지 기다린다. 다른 페이지에 있어 화면이 아직 그리지 않은 item도 받을 때는 새 그림이어야 한다.
 * 이미 다시 그리는 중이면(공통 속성 변경, 페이지 이동, 화면 크기 변경) 그 job이 끝나기를 기다린다.
 * 한 번도 그리지 않은 item(처음 draw 중)은 기다리지 않는다. 받는 쪽이 그림 없는 item으로 처리한다.
 */
async function freshStates(
  chartId: string,
  jobId: string,
  keys: string[],
  onRefresh?: (pending: number) => void,
): Promise<ItemState[]> {
  const deadline = Date.now() + FRESH_TIMEOUT_MS;
  for (;;) {
    const states: ItemState[] = [];
    for (let i = 0; i < keys.length; i += RANGE_SIZE) {
      const state = await api.jobItems(
        jobId,
        keys.slice(i, i + RANGE_SIZE),
        -1,
      );
      states.push(...state.items);
    }
    const stale = states.filter((s) => s.stale).map((s) => s.key);
    // 예전 그림을 둔 채 다시 그리는 중인 item
    const redrawing = states.filter(
      (s) => s.image && (s.status === "queued" || s.status === "running"),
    );
    if (stale.length === 0 && redrawing.length === 0) return states;
    if (Date.now() > deadline)
      throw new Error(
        "새 설정으로 다시 그리는 데 시간이 너무 걸립니다. 잠시 뒤 다시 받아 주세요.",
      );
    onRefresh?.(stale.length + redrawing.length);
    for (let i = 0; i < stale.length; i += RANGE_SIZE) {
      // 이미 다시 그리는 중인 item뿐이면 409다. 그 job이 끝나기를 기다린다.
      await api
        .refreshItems(chartId, stale.slice(i, i + RANGE_SIZE))
        .catch(() => {});
    }
    await sleep(FRESH_POLL_MS);
  }
}

/** item 하나의 지금 상태. since=-1이라 long polling을 기다리지 않고 바로 받는다. */
export async function drawnItemState(jobId: string, key: string) {
  const state = await api.jobItems(jobId, [key], -1);
  const item = state.items[0];
  if (!item?.image) throw new Error("아직 그려지지 않은 차트입니다.");
  return { ...item, image: item.image };
}

/** 고른 item이 그린 데이터(선택 영역이 있으면 그 안)를 '이름.csv'로 내려받는다. */
export async function downloadItemData(
  chartId: string,
  jobId: string,
  key: string,
) {
  const item = await drawnItemState(jobId, key);
  const csv = await api.exportItemRows(chartId, key);
  const suffix = item.selectedCount !== undefined ? "_선택" : "";
  saveBlob(csv, `${safeFileName(item.label)}${suffix}.csv`);
}

/** 고른 item의 PNG를 '이름.png'로 내려받는다. 예전 그림(stale)이면 새 설정으로 그린 뒤 받는다. */
export async function downloadChartPng(
  chartId: string,
  jobId: string,
  key: string,
) {
  await freshStates(chartId, jobId, [key]);
  const item = await drawnItemState(jobId, key);
  const png = await fetchPng(item.image.url);
  saveBlob(
    new Blob([png], { type: "image/png" }),
    `${safeFileName(item.label)}.png`,
  );
}

/** job의 모든 item 상태를 앞에서부터 limit개까지 받는다. */
async function allItems(jobId: string, limit: number) {
  const items: ItemState[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (items.length < Math.min(total, limit)) {
    const count = Math.min(RANGE_SIZE, limit - items.length);
    const state = await api.jobRange(jobId, items.length, count, -1);
    total = state.totalItems ?? 0;
    if (state.items.length === 0) break;
    items.push(...state.items);
  }
  return { items, total: Number.isFinite(total) ? total : items.length };
}

/** 엑셀 기본 칸 크기(px). 이미지를 칸 단위로 놓을 때 쓴다. */
const COL_PX = 64;
const ROW_PX = 20;
const GAP_PX = 16;

/**
 * 모든 item의 PNG를 엑셀 한 시트에 차트 grid와 같은 열 수로 놓는다. 이름은 이미지 위 칸에 적고,
 * 두 번째 시트에 item 목록(순번·이름·상태)을 둔다. 그리지 못한 item은 목록에만 남는다.
 * onProgress는 넣은 item 수를 알린다.
 */
export async function downloadAllChartsExcel(
  chartId: string,
  jobId: string,
  spec: ChartSpec,
  onProgress?: (done: number, total: number) => void,
  /** 예전 그림(stale)인 item을 새로 그리는 동안 남은 수 */
  onRefresh?: (pending: number) => void,
) {
  const [{ default: ExcelJS }, listed] = await Promise.all([
    import("exceljs"),
    allItems(jobId, MAX_EXCEL_ITEMS),
  ]);
  const { total } = listed;
  // 다른 페이지의 item은 공통 속성이 바뀐 뒤 아직 예전 그림일 수 있다. 넣기 전에 새로 그린다.
  const items = listed.items.some(
    (i) =>
      i.stale || (i.image && (i.status === "queued" || i.status === "running")),
  )
    ? await freshStates(
        chartId,
        jobId,
        listed.items.map((i) => i.key),
        onRefresh,
      )
    : listed.items;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("차트");
  const list = book.addWorksheet("목록");
  list.columns = [
    { header: "순번", key: "index", width: 8 },
    { header: "이름", key: "label", width: 40 },
    { header: "상태", key: "status", width: 12 },
  ];

  const cols = spec.grid.cols;
  let done = 0;
  for (const [index, item] of items.entries()) {
    list.addRow({ index: index + 1, label: item.label, status: item.status });
    const image = item.image;
    if (image) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      // 칸 하나 = 이미지 + 간격. 이름 한 줄을 이미지 위에 둔다.
      const left = (col * (image.width + GAP_PX)) / COL_PX;
      const top = (row * (image.height + ROW_PX + GAP_PX)) / ROW_PX;
      sheet.getCell(Math.floor(top) + 1, Math.floor(left) + 1).value =
        item.label;
      const imageId = book.addImage({
        buffer: await fetchPng(image.url),
        extension: "png",
      });
      sheet.addImage(imageId, {
        tl: { col: left, row: top + 1 },
        ext: { width: image.width, height: image.height },
      });
    }
    done++;
    onProgress?.(done, items.length);
  }

  const buffer = await book.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeFileName(`${spec.chartType}_${spec.x}_${spec.y}`)}.xlsx`,
  );
  return { written: items.length, total };
}
