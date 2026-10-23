// 피드 imports API: vis-a-lot 차트 공유 → 차트 게시물 입력.

import { feedClient, unwrap } from "./client";

export const importsApi = {
  chartShare: (shareId: string) =>
    unwrap(
      feedClient.GET("/imports/chart-shares/{shareId}", {
        params: { path: { shareId } },
      }),
    ),
};
