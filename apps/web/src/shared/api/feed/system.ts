// 피드 system API: 부트스트랩, 리셋, 시계.

import { feedClient, unwrap } from "./client";

export const systemApi = {
  status: () => unwrap(feedClient.GET("/system/status")),
  bootstrap: () => unwrap(feedClient.POST("/system/bootstrap")),
  reset: () => unwrap(feedClient.POST("/system/reset")),
  clock: () => unwrap(feedClient.GET("/system/clock")),
  setClock: (offsetMs: number) =>
    unwrap(feedClient.PUT("/system/clock", { body: { offsetMs } })),
};
