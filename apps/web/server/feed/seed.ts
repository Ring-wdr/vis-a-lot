// 피드 시드: 기본 시나리오 적재와 JSON 백업·복원 (/feed/dev/seed).

import { defineOps, FeedError } from "./context";
import { FEED_SCHEMA_VERSION } from "./ddl";
import { buildDefaultScenario } from "./seed/default-scenario";
import {
  clearTables,
  exportTables,
  type FeedSnapshot,
  insertTables,
  validateSnapshot,
} from "./seed/snapshot";
import { iso } from "./time";

export type SeedScenario = "default";
export type { FeedSnapshot } from "./seed/snapshot";

export const seedOps = defineOps({
  /** 빈 스키마에 시나리오를 적재한다. 사용자가 있으면 409 */
  "seed.load": async (ctx, args: { scenario: SeedScenario }) => {
    if (args.scenario !== "default")
      throw new FeedError(400, `모르는 시나리오입니다: ${args.scenario}`);
    const existing = await ctx.db
      .selectFrom("users")
      .select("id")
      .limit(1)
      .executeTakeFirst();
    if (existing) throw new FeedError(409, "피드가 비어 있지 않습니다");
    await insertTables(ctx.db, buildDefaultScenario(ctx.now));
    return { loaded: true };
  },

  /** 피드 데이터 전체를 스냅숏으로 (meta 제외) */
  "seed.export": async (ctx): Promise<FeedSnapshot> => ({
    schemaVersion: FEED_SCHEMA_VERSION,
    exportedAt: iso(ctx.now),
    tables: await exportTables(ctx.db),
  }),

  /** 피드 데이터를 지우고 스냅숏으로 채운다. 버전이 다르거나 모르는 테이블이면 400 */
  "seed.import": async (ctx, snapshot: FeedSnapshot) => {
    const tables = validateSnapshot(snapshot);
    await clearTables(ctx.db);
    return { rows: await insertTables(ctx.db, tables) };
  },
});
