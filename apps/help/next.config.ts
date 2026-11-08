import createMDX from "@next/mdx";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// 도움말 문서(/help/**). 로그인 없이 열리는 정적 페이지다. 같은 사이트에서 경로로 web 앱과 나뉘므로
// basePath를 쓰지 않고 라우트를 app/help/ 아래에 그대로 둔다 (Vercel Microfrontends는 basePath를 지원하지 않는다).
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

// Vercel Microfrontends의 자식 앱이다 (apps/web/microfrontends.json, docs/deploy.md).
// withMicrofrontends가 assetPrefix를 /help-assets로 정해 JS·CSS 경로가 web 앱의 /_next와 겹치지 않게 한다.
// - dev: 자식 앱의 /help-assets/_next/** 요청을 /_next/**로 돌리는 rewrites가 필요하다 (next dev가 처리한다).
// - build: 정적 export에는 rewrites가 없다. 대신 build 스크립트(scripts/prefix-assets.mjs)가 out/_next를
//   out/help-assets/_next로 옮겨 파일이 그 경로에 실제로 있게 한다. rewrites를 빼야 export 경고도 없고,
//   배포가 out/에 있는 파일 그대로 동작한다.
export default (phase: string) =>
  withMicrofrontends(withMDX(nextConfig), {
    skipTransforms: phase === PHASE_PRODUCTION_BUILD ? ["rewrites"] : [],
  });
