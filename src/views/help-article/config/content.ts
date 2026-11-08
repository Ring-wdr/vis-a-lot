import type { MDXContent } from "mdx/types";
import type { HelpService } from "@/shared/config/help";
import type { Locale } from "@/shared/config/locale";

type Loader = () => Promise<{ default: MDXContent }>;

// 문서 본문. 한국어는 <slug>.mdx, 영어는 <slug>.en.mdx, 일본어는 <slug>.ja.mdx다. 화면은 모든 언어 본문을 함께 그리고 <html lang>에 맞는 쪽을 보인다.
// import 경로는 문자열 그대로 적어야 번들러가 파일을 찾는다.
// 목차(shared/config/help.ts)에 문서를 더하면 여기에도 한 줄 더한다. 빠지면 빌드가 실패한다.
export const HELP_CONTENT: Record<
  HelpService,
  Record<string, Record<Locale, Loader>>
> = {
  vis: {
    "getting-started": {
      ko: () => import("@content/help/vis/getting-started.mdx"),
      en: () => import("@content/help/vis/getting-started.en.mdx"),
      ja: () => import("@content/help/vis/getting-started.ja.mdx"),
    },
    data: {
      ko: () => import("@content/help/vis/data.mdx"),
      en: () => import("@content/help/vis/data.en.mdx"),
      ja: () => import("@content/help/vis/data.ja.mdx"),
    },
    draw: {
      ko: () => import("@content/help/vis/draw.mdx"),
      en: () => import("@content/help/vis/draw.en.mdx"),
      ja: () => import("@content/help/vis/draw.ja.mdx"),
    },
    "chart-types": {
      ko: () => import("@content/help/vis/chart-types.mdx"),
      en: () => import("@content/help/vis/chart-types.en.mdx"),
      ja: () => import("@content/help/vis/chart-types.ja.mdx"),
    },
    filter: {
      ko: () => import("@content/help/vis/filter.mdx"),
      en: () => import("@content/help/vis/filter.en.mdx"),
      ja: () => import("@content/help/vis/filter.ja.mdx"),
    },
    explore: {
      ko: () => import("@content/help/vis/explore.mdx"),
      en: () => import("@content/help/vis/explore.en.mdx"),
      ja: () => import("@content/help/vis/explore.ja.mdx"),
    },
    customize: {
      ko: () => import("@content/help/vis/customize.mdx"),
      en: () => import("@content/help/vis/customize.en.mdx"),
      ja: () => import("@content/help/vis/customize.ja.mdx"),
    },
    "export-share": {
      ko: () => import("@content/help/vis/export-share.mdx"),
      en: () => import("@content/help/vis/export-share.en.mdx"),
      ja: () => import("@content/help/vis/export-share.ja.mdx"),
    },
    history: {
      ko: () => import("@content/help/vis/history.mdx"),
      en: () => import("@content/help/vis/history.en.mdx"),
      ja: () => import("@content/help/vis/history.ja.mdx"),
    },
    faq: {
      ko: () => import("@content/help/vis/faq.mdx"),
      en: () => import("@content/help/vis/faq.en.mdx"),
      ja: () => import("@content/help/vis/faq.ja.mdx"),
    },
  },
  feed: {},
};
