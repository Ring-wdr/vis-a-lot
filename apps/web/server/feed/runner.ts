// op 실행기 (DB Worker 안). 사용자를 읽고, 트랜잭션 하나로 op를 돌리고, 도메인 오류를 상태 코드로 돌려준다.

import type { Kysely } from "kysely";
import { type Actor, FeedError, type Op, type OpCtx } from "./context";
import type { FeedDatabase } from "./db";
import { FEED_OPS } from "./ops";

export type FeedRequest = {
  op: string;
  args: unknown;
  /** 화면에서 고른 사용자. 없으면 null */
  actorId: string | null;
  /** 시계 오프셋이 반영된 지금 (epoch ms) */
  now: number;
};

export type FeedReply =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string };

async function loadActor(ctx: Pick<OpCtx, "db">, actorId: string | null) {
  if (!actorId) return null;
  const user = await ctx.db
    .selectFrom("users")
    .select(["id", "name", "is_admin", "active"])
    .where("id", "=", actorId)
    .executeTakeFirst();
  if (!user?.active)
    throw new FeedError(401, `알 수 없는 사용자입니다: ${actorId}`);
  return {
    id: user.id,
    name: user.name,
    isAdmin: user.is_admin,
  } satisfies Actor;
}

export async function runFeedOp(
  db: Kysely<FeedDatabase>,
  request: FeedRequest,
): Promise<FeedReply> {
  const op = (FEED_OPS as Record<string, Op>)[request.op];
  if (!op)
    return { ok: false, status: 404, error: `unknown op: ${request.op}` };
  try {
    const value = await db.transaction().execute(async (trx) => {
      const actor = await loadActor({ db: trx }, request.actorId);
      return op({ db: trx, actor, now: new Date(request.now) }, request.args);
    });
    return { ok: true, value };
  } catch (err) {
    if (err instanceof FeedError)
      return { ok: false, status: err.status, error: err.message };
    throw err;
  }
}
