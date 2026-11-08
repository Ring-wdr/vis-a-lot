// 지금 차트로 chart 서비스 공유(스냅숏)를 만든다. '링크 복사'와 '피드에 올리기'가 같이 쓴다.

import { ApiRequestError, api } from "@/shared/api/api";

export async function createChartShare(args: {
  chartId: string;
  /** 대표 이미지로 쓸 item. 없으면 처음 그려진 item */
  selectedItem: string | null;
  title: string;
}) {
  const create = (itemKey?: string) =>
    api.createShare({ chartId: args.chartId, itemKey, title: args.title });
  // 고른 item이 아직 그려지지 않았으면(409) 처음 그려진 item으로 만든다.
  return create(args.selectedItem ?? undefined).catch((err) => {
    if (
      args.selectedItem &&
      err instanceof ApiRequestError &&
      err.status === 409
    )
      return create();
    throw err;
  });
}
