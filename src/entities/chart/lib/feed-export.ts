// 피드로 보내기. 차트 하나를 데이터 공유 피드의 차트 게시물 입력으로 쓸 JSON 묶음으로 만든다.
// 두 앱 모두 브라우저 안에서만 돌아 서로 API를 부를 수 없으므로 클립보드로 넘긴다.
// 받는 쪽은 thumbnail을 게시물 대표 이미지로, payload를 게시물의 차트 데이터로 저장하고, link로 이 차트를 다시 연다.
// 내용은 chart 서비스의 공유(POST /api/chart/shares) 스냅숏이고, shareId로 그 공유를 다시 찾을 수 있다.

import type { ChartSpec, DatasetStatus, ItemRestore } from "@/shared/api/types";

export const FEED_EXPORT_SOURCE = "vis-a-lot";
export const FEED_EXPORT_VERSION = 1;

export type FeedExport = {
  source: typeof FEED_EXPORT_SOURCE;
  v: typeof FEED_EXPORT_VERSION;
  kind: "chart";
  /** chart 서비스 공유 id. 실서버로 옮기면 받는 쪽이 GET /api/chart/shares/{shareId}로 최신 메타를 읽는다. */
  shareId: string;
  title: string;
  /** 대표 이미지: 고른 item(없으면 처음 그려진 item)의 PNG data URL */
  thumbnail: string;
  /** 대표 PNG 주소 (GET /api/chart/shares/{shareId}/png). 프로토타입에서는 vis-a-lot 브라우저 안에서만 열린다 */
  imageUrl: string;
  /** 이 차트를 다시 여는 공유 링크 */
  link: string;
  /** 다른 브라우저에서도 link가 같은 차트를 여는지. 업로드 데이터는 그 브라우저에만 있어 false */
  portable: boolean;
  payload: {
    spec: ChartSpec;
    restore: Record<string, ItemRestore>;
    dataset: { id: string; name: string; kind: DatasetStatus["kind"] };
    /** 대표 이미지로 쓴 item */
    item: { key: string; label: string; width: number; height: number };
  };
};

export function feedExport(args: {
  shareId: string;
  title: string;
  thumbnail: string;
  imageUrl: string;
  link: string;
  spec: ChartSpec;
  restore: Record<string, ItemRestore>;
  dataset: FeedExport["payload"]["dataset"];
  item: FeedExport["payload"]["item"];
}): FeedExport {
  const { shareId, title, thumbnail, imageUrl, link } = args;
  const { spec, restore, dataset, item } = args;
  return {
    source: FEED_EXPORT_SOURCE,
    v: FEED_EXPORT_VERSION,
    kind: "chart",
    shareId,
    title,
    thumbnail,
    imageUrl,
    link,
    portable: dataset.kind === "sample",
    payload: { spec, restore, dataset, item },
  };
}

/** 받는 쪽(피드)에서 붙여넣은 텍스트를 읽을 때 쓰는 검사. 다른 텍스트나 다른 버전이면 undefined */
export function readFeedExport(text: string): FeedExport | undefined {
  try {
    const value = JSON.parse(text) as Partial<FeedExport>;
    if (
      value?.source !== FEED_EXPORT_SOURCE ||
      value.v !== FEED_EXPORT_VERSION ||
      value.kind !== "chart" ||
      typeof value.shareId !== "string" ||
      typeof value.thumbnail !== "string" ||
      typeof value.link !== "string" ||
      !value.payload?.spec
    )
      return undefined;
    return value as FeedExport;
  } catch {
    return undefined;
  }
}
