// 피드 posts API. postId 자리에는 게시물 id나 이슈 키(FD-12)를 넣는다.

import { feedClient, unwrap } from "./client";
import type {
  BulkUpdateRequest,
  CreatePostRequest,
  PostQueryRequest,
  RelationRequest,
  TransitionRequest,
  UpdateChecklistItemRequest,
  UpdatePostRequest,
} from "./types";

const post = (postId: string) => ({ params: { path: { postId } } });
const item = (postId: string, itemId: string) => ({
  params: { path: { postId, itemId } },
});

export const postsApi = {
  query: (body: PostQueryRequest) =>
    unwrap(feedClient.POST("/posts/query", { body })),
  mySummary: () => unwrap(feedClient.GET("/posts/my-summary")),
  get: (postId: string) =>
    unwrap(feedClient.GET("/posts/{postId}", post(postId))),
  create: (body: CreatePostRequest) =>
    unwrap(feedClient.POST("/posts", { body })),
  update: (postId: string, body: UpdatePostRequest) =>
    unwrap(feedClient.PATCH("/posts/{postId}", { ...post(postId), body })),
  remove: (postId: string) =>
    unwrap(feedClient.DELETE("/posts/{postId}", post(postId))),
  transition: (postId: string, body: TransitionRequest) =>
    unwrap(
      feedClient.POST("/posts/{postId}/transition", { ...post(postId), body }),
    ),
  requestReview: (postId: string) =>
    unwrap(feedClient.POST("/posts/{postId}/request-review", post(postId))),
  approve: (postId: string) =>
    unwrap(feedClient.POST("/posts/{postId}/approve", post(postId))),
  reject: (postId: string, comment: string) =>
    unwrap(
      feedClient.POST("/posts/{postId}/reject", {
        ...post(postId),
        body: { comment },
      }),
    ),
  reopen: (postId: string) =>
    unwrap(feedClient.POST("/posts/{postId}/reopen", post(postId))),
  pin: (postId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/posts/{postId}/pin", { ...post(postId), body: { on } }),
    ),
  bulk: (body: BulkUpdateRequest) =>
    unwrap(feedClient.POST("/posts/bulk", { body })),
  setParent: (postId: string, parentId: string | null) =>
    unwrap(
      feedClient.PUT("/posts/{postId}/parent", {
        ...post(postId),
        body: { parentId },
      }),
    ),
  addRelation: (postId: string, body: RelationRequest) =>
    unwrap(
      feedClient.POST("/posts/{postId}/relations", { ...post(postId), body }),
    ),
  removeRelation: (postId: string, body: RelationRequest) =>
    unwrap(
      feedClient.POST("/posts/{postId}/relations/remove", {
        ...post(postId),
        body,
      }),
    ),
  addChecklistItem: (postId: string, text: string) =>
    unwrap(
      feedClient.POST("/posts/{postId}/checklist", {
        ...post(postId),
        body: { text },
      }),
    ),
  updateChecklistItem: (
    postId: string,
    itemId: string,
    body: UpdateChecklistItemRequest,
  ) =>
    unwrap(
      feedClient.PATCH("/posts/{postId}/checklist/{itemId}", {
        ...item(postId, itemId),
        body,
      }),
    ),
  removeChecklistItem: (postId: string, itemId: string) =>
    unwrap(
      feedClient.DELETE(
        "/posts/{postId}/checklist/{itemId}",
        item(postId, itemId),
      ),
    ),
  reorderChecklist: (postId: string, ids: string[]) =>
    unwrap(
      feedClient.PUT("/posts/{postId}/checklist/order", {
        ...post(postId),
        body: { ids },
      }),
    ),
  subscribe: (postId: string, on: boolean) =>
    unwrap(
      feedClient.PUT("/posts/{postId}/subscribe", {
        ...post(postId),
        body: { on },
      }),
    ),
  events: (postId: string) =>
    unwrap(feedClient.GET("/posts/{postId}/events", post(postId))),
};
