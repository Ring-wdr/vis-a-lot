import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 없이 정적 호스팅한다. "서버"는 브라우저 안의 MSW + Worker가 맡는다.
  output: "export",
  experimental: {
    agentFeedback: true,
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
