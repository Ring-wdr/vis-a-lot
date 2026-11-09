// 피드 seed API (/feed/dev/seed): JSON 내보내기·가져오기. 리셋은 system API에 있다.

import { feedClient, unwrap } from "./client";
import type { FeedSnapshot } from "./types";

export const seedApi = {
  export: () => unwrap(feedClient.GET("/seed/export")),
  import: (snapshot: FeedSnapshot) =>
    unwrap(feedClient.POST("/seed/import", { body: snapshot })),
};
