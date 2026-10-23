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
  },
});
