// 테스트용 피드 DB. 메모리 PGlite에 DDL을 올리고 op를 실행하는 헬퍼를 준다.
// 사용: const t = await createTestFeed(); await t.run('posts.create', args, { actor: 'u1' });

import { PGlite } from "@electric-sql/pglite";
import type { Kysely } from "kysely";
import { createFeedDb, type FeedDatabase } from "./db";
import { resetFeed } from "./migrate";
import type { FeedArgs, FeedOpName, FeedResult } from "./ops";
import { runFeedOp } from "./runner";

export type TestFeed = {
  pglite: PGlite;
  db: Kysely<FeedDatabase>;
  /** op 하나를 실행한다. 도메인 오류는 { status, error }를 담은 Error로 던진다 */
  run<K extends FeedOpName>(
    op: K,
    args: FeedArgs<K>,
    options?: { actor?: string | null; now?: Date },
  ): Promise<FeedResult<K>>;
};

export class TestFeedError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createTestFeed(): Promise<TestFeed> {
  const pglite = new PGlite();
  await resetFeed(pglite);
  const db = createFeedDb(pglite);
  return {
    pglite,
    db,
    async run(op, args, options = {}) {
      const reply = await runFeedOp(db, {
        op,
        args,
        actorId: options.actor ?? null,
        now: (options.now ?? new Date("2026-10-23T09:00:00+09:00")).getTime(),
      });
      if (!reply.ok) throw new TestFeedError(reply.status, reply.error);
      return reply.value as never;
    },
  };
}
