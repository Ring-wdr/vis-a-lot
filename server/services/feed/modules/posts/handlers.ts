// 피드 posts API handler. /posts/my-summary·/posts/query·/posts/bulk를 /posts/{postId}보다 먼저 붙인다.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";
export function registerPosts(app: FeedApp) {
  return app
    .openapi(routes.getMyWorkSummary, async (c) =>
      c.json(await feedCall(c, "posts.mySummary", undefined), 200),
    )
    .openapi(routes.queryPosts, async (c) =>
      c.json(await feedCall(c, "posts.query", c.req.valid("json")), 200),
    )
    .openapi(routes.bulkUpdatePosts, async (c) =>
      c.json(await feedCall(c, "posts.bulkUpdate", c.req.valid("json")), 200),
    )
    .openapi(routes.createPost, async (c) =>
      c.json(await feedCall(c, "posts.create", c.req.valid("json")), 201),
    )
    .openapi(routes.getPost, async (c) =>
      c.json(await feedCall(c, "posts.get", c.req.valid("param")), 200),
    )
    .openapi(routes.updatePost, async (c) =>
      c.json(
        await feedCall(c, "posts.update", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.deletePost, async (c) => {
      await feedCall(c, "posts.delete", c.req.valid("param"));
      return c.body(null, 204);
    })
    .openapi(routes.transitionPost, async (c) =>
      c.json(
        await feedCall(c, "posts.transition", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.requestPostReview, async (c) =>
      c.json(
        await feedCall(c, "posts.requestReview", c.req.valid("param")),
        200,
      ),
    )
    .openapi(routes.approvePost, async (c) =>
      c.json(await feedCall(c, "posts.approve", c.req.valid("param")), 200),
    )
    .openapi(routes.rejectPost, async (c) =>
      c.json(
        await feedCall(c, "posts.reject", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.reopenPost, async (c) =>
      c.json(await feedCall(c, "posts.reopen", c.req.valid("param")), 200),
    )
    .openapi(routes.pinPost, async (c) =>
      c.json(
        await feedCall(c, "posts.pin", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.setPostParent, async (c) =>
      c.json(
        await feedCall(c, "posts.setParent", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.addPostRelation, async (c) =>
      c.json(
        await feedCall(c, "posts.addRelation", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.removePostRelation, async (c) =>
      c.json(
        await feedCall(c, "posts.removeRelation", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.addChecklistItem, async (c) =>
      c.json(
        await feedCall(c, "posts.checklistAdd", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.reorderChecklist, async (c) =>
      c.json(
        await feedCall(c, "posts.checklistReorder", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.updateChecklistItem, async (c) =>
      c.json(
        await feedCall(c, "posts.checklistUpdate", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.removeChecklistItem, async (c) =>
      c.json(
        await feedCall(c, "posts.checklistRemove", c.req.valid("param")),
        200,
      ),
    )
    .openapi(routes.subscribePost, async (c) =>
      c.json(
        await feedCall(c, "posts.subscribe", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.listPostEvents, async (c) =>
      c.json(await feedCall(c, "posts.events", c.req.valid("param")), 200),
    );
}
