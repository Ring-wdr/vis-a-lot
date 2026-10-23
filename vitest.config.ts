import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  test: {
    // Claude Code 서브 에이전트의 worktree(.claude/worktrees)는 다른 체크아웃이라 돌리지 않는다.
    exclude: [...configDefaults.exclude, ".claude/**"],
    // 피드 테스트는 파일마다 처음에 PGlite(WASM Postgres)를 띄운다. 병렬 실행에서는 5초를 넘기기도 한다.
    testTimeout: 30_000,
  },
});
