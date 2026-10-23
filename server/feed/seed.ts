// 피드 시드. (구현: 시드 모듈 작업)

import { defineOps } from "./context";

export type SeedScenario = "default";

export const seedOps = defineOps({
  /** 빈 스키마에 시나리오를 적재한다. */
  "seed.load": async (_ctx, _args: { scenario: SeedScenario }) => ({
    loaded: false,
  }),
});
