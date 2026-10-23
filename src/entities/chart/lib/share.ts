// 공유 링크 두 가지.
// - 공유 페이지(/share?id=…): chart 서비스에 고정한 공유(스냅숏)를 보여준다. 지금 '링크 복사'가 만드는 링크다.
// - hash 링크(#s=…): 설정과 item 상태를 lz-string으로 압축해 URL hash에 담는다 (서버로 보내지 않는다).
//   예전에 복사한 링크도 계속 열린다.
// 샘플 데이터는 시드가 고정이라 설정과 item 상태만 있으면 같은 차트가 다시 만들어진다.
// 업로드한 데이터는 그 브라우저에만 있으므로 같은 브라우저에서만 열린다.

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { ChartSpec, HistoryDetail, ItemRestore } from "@/shared/api/types";
import { legacyDatasetOf } from "@/shared/config/dataset";

const PREFIX = "#s=";

/** 공유 페이지 경로. 정적 호스팅이라 id는 경로가 아니라 query로 받는다. */
export const SHARE_PAGE = "/share";

export function sharePagePath(shareId: string) {
  return `${SHARE_PAGE}?id=${encodeURIComponent(shareId)}`;
}

export function sharePageUrl(shareId: string) {
  return new URL(sharePagePath(shareId), location.origin).toString();
}
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
    const hasFavorites = (item.favorites?.length ?? 0) > 0;
    const hasLegendGroups = (item.legendGroups?.length ?? 0) > 0;
    const hasDeletions = (item.deletions?.length ?? 0) > 0;
    if (
      !item.view &&
      item.shapes.length === 0 &&
      !item.color &&
      !hasLegendColors &&
      !item.legendPosition &&
      !item.selection &&
      !hasFavorites &&
      !hasLegendGroups &&
      !hasDeletions
    )
      continue;
    restore[key] = {
      view: item.view,
      shapes: item.shapes,
      color: item.color,
      ...(hasLegendColors ? { legendColors: item.legendColors } : {}),
      ...(item.legendPosition ? { legendPosition: item.legendPosition } : {}),
      ...(item.selection ? { selection: item.selection } : {}),
      ...(hasFavorites ? { favorites: item.favorites } : {}),
      ...(hasLegendGroups ? { legendGroups: item.legendGroups } : {}),
      ...(hasDeletions ? { deletions: item.deletions } : {}),
    };
  }
  return restore;
}

export function encodeShareHash(shared: SharedChart) {
  const payload: Payload = { v: SHARE_VERSION, ...shared };
  return `${PREFIX}${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function readShareHash(hash: string): SharedChart | undefined {
  if (!hash.startsWith(PREFIX)) return undefined;
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(PREFIX.length));
    const payload = json ? (JSON.parse(json) as Payload) : undefined;
    if (payload?.v !== SHARE_VERSION || !payload.spec) return undefined;
    // 행 수(rows)로 데이터셋을 구분하던 예전 링크
    const { rows, ...spec } = payload.spec as ChartSpec & { rows?: number };
    return {
      spec: spec.dataset
        ? spec
        : { ...spec, dataset: legacyDatasetOf(rows ?? 0) },
      restore: payload.restore ?? {},
    };
  } catch {
    return undefined;
  }
}
