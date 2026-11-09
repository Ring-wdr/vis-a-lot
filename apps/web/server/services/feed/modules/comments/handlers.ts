// 피드 comments API handler: 댓글·반응·투표·스레드 해결·고정, 게시물 첨부.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerComments(app: FeedApp) {
  return app
    .openapi(routes.listComments, async (c) =>
      c.json(await feedCall(c, "comments.list", c.req.valid("param")), 200),
    )
    .openapi(routes.createComment, async (c) =>
      c.json(
        await feedCall(c, "comments.create", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        201,
      ),
    )
    .openapi(routes.updateComment, async (c) =>
      c.json(
        await feedCall(c, "comments.update", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.deleteComment, async (c) => {
      await feedCall(c, "comments.delete", c.req.valid("param"));
      return c.body(null, 204);
    })
    .openapi(routes.resolveComment, async (c) =>
      c.json(
        await feedCall(c, "comments.resolve", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.pinComment, async (c) =>
      c.json(
        await feedCall(c, "comments.pin", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.reactComment, async (c) =>
      c.json(
        await feedCall(c, "comments.react", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.votePoll, async (c) =>
      c.json(
        await feedCall(c, "polls.vote", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        200,
      ),
    )
    .openapi(routes.addPostAttachment, async (c) =>
      c.json(
        await feedCall(c, "attachments.add", {
          ...c.req.valid("json"),
          ...c.req.valid("param"),
        }),
        201,
      ),
    )
    .openapi(routes.removePostAttachment, async (c) => {
      await feedCall(c, "attachments.remove", c.req.valid("param"));
      return c.body(null, 204);
    });
}
