// handler → DB Worker의 피드 op 호출. 사용자(x-feed-user 헤더)와 시계를 붙이고, 도메인 오류를 HTTP 오류로 바꾼다.

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { FeedArgs, FeedOpName, FeedResult } from "../../feed/ops";
import { getRuntime } from "../../runtime";
import type { ApiError } from "../common/http";
import { feedNow } from "./clock";
import { FEED_USER_HEADER } from "./security";

export async function feedCall<K extends FeedOpName>(
  c: Context,
  op: K,
  args: FeedArgs<K>,
): Promise<FeedResult<K>> {
  const reply = await getRuntime().db.call("feed", {
    op,
    args,
    actorId: c.req.header(FEED_USER_HEADER) ?? null,
    now: feedNow(),
  });
  if (!reply.ok) {
    const status = reply.status as ContentfulStatusCode;
    throw new HTTPException(status, {
      res: Response.json({ error: reply.error } satisfies ApiError, {
        status,
      }),
    });
  }
  return reply.value as FeedResult<K>;
}
