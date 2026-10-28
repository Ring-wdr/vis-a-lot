import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 없이 정적 호스팅한다. "서버"는 브라우저 안의 MSW + Worker가 맡는다.
  output: "export",
  experimental: {
    agentFeedback: true,
    // Lingui 매크로(t``, <Trans>, msg``)를 빌드 때 풀어 쓴다. 이름만 적으면 조용히 꺼지므로 [이름, 옵션] 쌍으로 적는다.
    // @lingui/swc-plugin은 Next에 묶인 swc_core와 맞아야 해서 정확한 버전으로 고정한다.
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
