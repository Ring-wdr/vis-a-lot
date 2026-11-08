import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// 도움말 문서(/help/**). 로그인 없이 열리는 정적 페이지다. 같은 사이트에서 경로로 web 앱과 나뉘므로
// basePath를 쓰지 않고 라우트를 app/help/ 아래에 그대로 둔다.
const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    agentFeedback: true,
    // Lingui 매크로를 빌드 때 풀어 쓴다 (apps/web/next.config.ts와 같은 설정).
    swcPlugins: [["@lingui/swc-plugin", {}]],
  },
};

// 도움말 본문(content/help/**/*.mdx). Turbopack에 넘기려면 플러그인을 이름 문자열로 적는다.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
