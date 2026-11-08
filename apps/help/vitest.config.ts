import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Lingui 매크로를 테스트에서도 풀어 쓴다 (Next 빌드는 SWC 플러그인, vitest는 vite 플러그인의 native transform).
  plugins: [lingui({ macroTransform: true })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@content": fileURLToPath(new URL("./content", import.meta.url)),
    },
  },
});
