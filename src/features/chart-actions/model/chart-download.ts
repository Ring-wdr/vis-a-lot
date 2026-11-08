// 차트 도구의 다운로드: 고른 item의 PNG와 데이터(CSV), 모든 item을 grid 배치로 넣은 엑셀(xlsx).

import { t } from "@lingui/core/macro";
import { api } from "@/shared/api/api";
import type { ChartSpec, ItemState } from "@/shared/api/types";
import { safeFileName, saveBlob } from "@/shared/lib/save-file";
import "../config/messages";

/** 엑셀 한 파일에 넣는 item 수 상한. 넘으면 앞에서부터 이만큼만 넣는다. */
export const MAX_EXCEL_ITEMS = 300;
/** job 상태를 한 번에 받는 item 수 (서버 pageSize 상한) */
const RANGE_SIZE = 100;

/** item 하나의 지금 상태. since=-1이라 long polling을 기다리지 않고 바로 받는다. */
export async function drawnItemState(jobId: string, key: string) {
  const state = await api.jobItems(jobId, [key], -1);
  const item = state.items[0];
  if (!item?.image) throw new Error(t`아직 그려지지 않은 차트입니다.`);
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
  const suffix =
    item.selectedCount !== undefined
      ? t({
          message: "_선택",
          context: "file name suffix",
          comment: "선택 영역의 데이터만 받은 CSV 파일 이름 끝에 붙인다",
        })
      : "";
  saveBlob(csv, `${safeFileName(item.label)}${suffix}.csv`);
}

/** 고른 item의 PNG를 '이름.png'로 내려받는다. 화면이 다크여도 파일은 light 테마다. */
export async function downloadChartPng(
  chartId: string,
  jobId: string,
  key: string,
) {
  const item = await drawnItemState(jobId, key);
  const png = await api.exportItemPng(chartId, key);
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
 * PNG는 light 테마다. 화면이 다크면 item마다 light로 한 장씩 더 그리므로 그만큼 오래 걸린다.
 * onProgress는 넣은 item 수를 알린다.
 */
export async function downloadAllChartsExcel(
  chartId: string,
  jobId: string,
  spec: ChartSpec,
  onProgress?: (done: number, total: number) => void,
) {
  const [{ default: ExcelJS }, { items, total }] = await Promise.all([
    import("exceljs"),
    allItems(jobId, MAX_EXCEL_ITEMS),
  ]);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(
    t({ message: "차트", context: "excel sheet" }),
  );
  const list = book.addWorksheet(
    t({ message: "목록", context: "excel sheet" }),
  );
  list.columns = [
    {
      header: t({ message: "순번", context: "excel column header" }),
      key: "index",
      width: 8,
    },
    {
      header: t({ message: "이름", context: "excel column header" }),
      key: "label",
      width: 40,
    },
    {
      header: t({ message: "상태", context: "excel column header" }),
      key: "status",
      width: 12,
    },
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
        buffer: await api.exportItemPng(chartId, item.key),
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
