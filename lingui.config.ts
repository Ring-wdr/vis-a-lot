import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// 문구 카탈로그는 FSD slice마다 하나씩 둔다 (docs/i18n.md). 한국어가 원문(sourceLocale)이고 영어는 en.po에 번역한다.
// 카탈로그는 config segment 안에 둬서 scripts/check-fsd.mjs의 위치 규칙을 지킨다.
// Lingui의 {name} 패턴은 모든 slice에 빈 카탈로그를 만들므로, 카탈로그를 등록하는 slice
// (config/messages.ts가 있는 slice)만 골라 목록을 만든다.
const exclude = ["**/*.test.*", "**/node_modules/**"];
const root = import.meta.dirname;

const slices = ["views", "widgets", "features", "entities"].flatMap((layer) =>
  fs
    .readdirSync(path.join(root, "src", layer))
    .filter((slice) =>
      fs.existsSync(path.join(root, "src", layer, slice, "config/messages.ts")),
    )
    .map((slice) => ({
      path: `<rootDir>/src/${layer}/${slice}/config/locales/{locale}`,
      include: [`<rootDir>/src/${layer}/${slice}/`],
      exclude,
    })),
);

export default defineConfig({
  sourceLocale: "ko",
  locales: ["ko", "en"],
  catalogs: [
    // application은 하위 폴더를 둘 수 없어 파일 이름에 언어를 넣는다.
    {
      path: "<rootDir>/src/application/messages.{locale}",
      include: ["<rootDir>/src/application/"],
      exclude,
    },
    ...slices,
    {
      path: "<rootDir>/src/shared/config/locales/{locale}",
      include: ["<rootDir>/src/shared/"],
      exclude,
    },
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: "ts",
});
