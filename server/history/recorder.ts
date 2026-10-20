// history 기록. draw마다 한 건을 만들고, 그 뒤의 확대·도형·색·공통 속성·grid 변경은 같은 건에 덧붙인다.
// resize는 화면 환경 값이라 기록하지 않는다.

import type {
  HistoryDetail,
  HistoryEventType,
  HistoryItem,
  ItemStatus,
  JobStatus,
} from "../api/types";
import type { ChartRecord } from "../charts/chart-store";
import { GENERATOR_VERSION } from "../data/schema";
import { matchPng } from "../png-store";
import { getRuntime } from "../runtime";

const THUMBNAIL_WIDTH = 240;

/** 새 history를 시작하거나, 기존 history를 이어서 쓴다. */
export async function attachHistory(chart: ChartRecord, historyId?: string) {
  const existing = historyId
    ? await getRuntime().db.call("historyGet", { id: historyId })
    : null;
  chart.history = existing
    ? {
        id: existing.id,
        createdAt: existing.createdAt,
        events: existing.events,
      }
    : { id: crypto.randomUUID(), createdAt: Date.now(), events: [] };
  // 새 history만 바로 목록에 보이게 저장한다. 이어 쓰는 history는 렌더가 끝난 뒤 저장해야
  // 저장돼 있던 item 상태를 빈 값으로 덮어쓰지 않는다.
  if (!existing) await saveHistory(chart, "init", new Map());
}

export function recordEvent(
  chart: ChartRecord,
  type: HistoryEventType,
  itemKey?: string,
) {
  chart.history?.events.push({ type, at: Date.now(), item: itemKey });
}

/** 현재 차트 상태를 그대로 저장한다. job이 끝날 때마다 불린다. */
export async function saveHistory(
  chart: ChartRecord,
  status: JobStatus,
  itemStatuses: Map<string, ItemStatus>,
) {
  const { history } = chart;
  if (!history) return;
  const items: Record<string, HistoryItem> = {};
  for (const item of chart.items ?? []) {
    items[item.key] = {
      label: item.label,
      status: itemStatuses.get(item.key) ?? "queued",
      view: item.view,
      shapes: item.shapes,
      color: item.props?.color,
    };
  }
  const entry: HistoryDetail = {
    id: history.id,
    createdAt: history.createdAt,
    updatedAt: Date.now(),
    rows: chart.spec.rows,
    generatorVersion: GENERATOR_VERSION,
    spec: chart.spec,
    status,
    itemCount: chart.items?.length ?? 0,
    statusCounts: {},
    eventCounts: {},
    thumbnail: await thumbnailOf(chart).catch(() => undefined),
    items,
    events: history.events,
  };
  await getRuntime().db.call("historySave", entry);
}

/** 첫 번째로 그려진 item의 PNG를 작게 줄여 목록 썸네일로 쓴다. */
async function thumbnailOf(chart: ChartRecord) {
  const item = chart.items?.find((i) => i.image);
  if (!item?.image) return undefined;
  const cached = await matchPng(new URL(item.image.url, location.origin).href);
  if (!cached) return undefined;
  const bitmap = await createImageBitmap(await cached.blob(), {
    resizeWidth: THUMBNAIL_WIDTH,
    resizeQuality: "medium",
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
