import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// 도움말 문서(/help/**). 로그인 없이 열리는 정적 페이지다.
// 배포에서는 web 프로젝트가 /help/**를 이 앱의 Vercel 프로젝트로 rewrite해 같은 도메인에 붙인다 (docs/deploy.md).
// 라우트는 basePath 없이 app/help/ 아래에 두어 페이지 경로가 처음부터 /help/**다.
// 자산(JS·CSS·폰트)은 assetPrefix로 /help/_next/**를 가리키게 해 web 앱의 /_next/**와 겹치지 않게 한다.
// 정적 export는 파일을 여전히 out/_next에 쓰므로, help 프로젝트의 vercel.json이 /help/_next/** → /_next/**로 잇는다.
// (next dev와 next start는 assetPrefix 경로를 스스로 처리한다.)
const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: "/help",
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
