import type { NextConfig } from "next";

// feed·시각화·공유·dev 화면. 도움말(/help/**)은 다른 앱(apps/help)이 내보낸다.
// 함께 쓰는 코드(@vis-a-lot/shared)는 workspace 패키지라 Turbopack이 알아서 컴파일한다.
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

export default nextConfig;
