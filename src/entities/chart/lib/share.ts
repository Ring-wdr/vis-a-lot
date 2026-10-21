// 공유 링크. 시드가 고정이라 설정과 item 상태만 있으면 같은 차트가 다시 만들어진다.
// 상태는 lz-string으로 압축해 URL hash에 담는다 (서버로 보내지 않는다).

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { ChartSpec, HistoryDetail, ItemRestore } from "@/shared/api/types";

const PREFIX = "#s=";
const SHARE_VERSION = 1;

export type SharedChart = {
  spec: ChartSpec;
  restore: Record<string, ItemRestore>;
};

type Payload = SharedChart & { v: number };

/** history 기록에서 복원에 필요한 item 상태만 꺼낸다. 아무것도 바뀌지 않은 item은 뺀다. */
export function restoreOf(detail: HistoryDetail): Record<string, ItemRestore> {
  const restore: Record<string, ItemRestore> = {};
  for (const [key, item] of Object.entries(detail.items)) {
    const hasLegendColors = Object.keys(item.legendColors ?? {}).length > 0;
    if (
      !item.view &&
      item.shapes.length === 0 &&
      !item.color &&
      !hasLegendColors &&
      !item.legendPosition
    )
      continue;
    restore[key] = {
      view: item.view,
      shapes: item.shapes,
      color: item.color,
      ...(hasLegendColors ? { legendColors: item.legendColors } : {}),
      ...(item.legendPosition ? { legendPosition: item.legendPosition } : {}),
    };
  }
  return restore;
}

export function encodeShareHash(shared: SharedChart) {
  const payload: Payload = { v: SHARE_VERSION, ...shared };
  return `${PREFIX}${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function shareUrl(shared: SharedChart) {
  const url = new URL(location.href);
  url.hash = encodeShareHash(shared);
  return url.toString();
}

export function readShareHash(hash: string): SharedChart | undefined {
  if (!hash.startsWith(PREFIX)) return undefined;
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(PREFIX.length));
    const payload = json ? (JSON.parse(json) as Payload) : undefined;
    if (payload?.v !== SHARE_VERSION || !payload.spec) return undefined;
    return { spec: payload.spec, restore: payload.restore ?? {} };
  } catch {
    return undefined;
  }
}
