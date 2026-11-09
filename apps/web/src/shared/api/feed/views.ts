// 피드 views API: 저장된 뷰.

import { feedClient, unwrap } from "./client";
import type { SaveViewRequest } from "./types";

const view = (viewId: string) => ({ params: { path: { viewId } } });

export const viewsApi = {
  list: (groupId?: string) =>
    unwrap(feedClient.GET("/views", { params: { query: { groupId } } })),
  get: (viewId: string) =>
    unwrap(feedClient.GET("/views/{viewId}", view(viewId))),
  save: (body: SaveViewRequest) => unwrap(feedClient.POST("/views", { body })),
  remove: (viewId: string) =>
    unwrap(feedClient.DELETE("/views/{viewId}", view(viewId))),
  pin: (viewId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/views/{viewId}/pin", { ...view(viewId), body: { on } }),
    ),
};
