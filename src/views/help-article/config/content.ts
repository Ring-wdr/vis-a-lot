import type { MDXContent } from "mdx/types";
import type { HelpService } from "@/shared/config/help";

type Loader = () => Promise<{ default: MDXContent }>;

// 문서 본문. import 경로는 문자열 그대로 적어야 번들러가 파일을 찾는다.
// 목차(shared/config/help.ts)에 문서를 더하면 여기에도 한 줄 더한다. 빠지면 빌드가 실패한다.
export const HELP_CONTENT: Record<HelpService, Record<string, Loader>> = {
  vis: {
    "getting-started": () => import("@content/help/vis/getting-started.mdx"),
    data: () => import("@content/help/vis/data.mdx"),
    draw: () => import("@content/help/vis/draw.mdx"),
    "chart-types": () => import("@content/help/vis/chart-types.mdx"),
    filter: () => import("@content/help/vis/filter.mdx"),
    explore: () => import("@content/help/vis/explore.mdx"),
    customize: () => import("@content/help/vis/customize.mdx"),
    "export-share": () => import("@content/help/vis/export-share.mdx"),
    history: () => import("@content/help/vis/history.mdx"),
    faq: () => import("@content/help/vis/faq.mdx"),
  },
  feed: {},
};
