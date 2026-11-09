import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Lingui 매크로를 테스트에서도 풀어 쓴다 (Next 빌드는 SWC 플러그인, vitest는 vite 플러그인의 native transform).
  plugins: [lingui({ macroTransform: true })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  test: {
    // 피드 테스트는 파일마다 처음에 PGlite(WASM Postgres)를 띄운다. 병렬 실행에서는 5초를 넘기기도 한다.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
