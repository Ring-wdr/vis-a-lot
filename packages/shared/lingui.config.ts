import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";
import { LOCALES } from "./config/locale";

// 두 앱이 함께 쓰는 컴포넌트의 문구는 이 패키지의 카탈로그 하나에 둔다 (docs/i18n.md).
// 앱의 카탈로그에 넣지 않으므로 앱마다 번역을 따로 채우지 않는다. 앱의 빌드·테스트가 이 카탈로그도 컴파일한다.
export default defineConfig({
  sourceLocale: "ko",
  locales: [...LOCALES],
  catalogs: [
    {
      path: "<rootDir>/config/locales/{locale}",
      include: ["<rootDir>/config/", "<rootDir>/lib/", "<rootDir>/ui/"],
      exclude: ["**/*.test.*", "**/node_modules/**"],
    },
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: "ts",
});
