import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 없이 정적 호스팅한다. "서버"는 브라우저 안의 MSW + Worker가 맡는다.
  output: "export",
  experimental: {
    agentFeedback: true,
  },
};

export default nextConfig;
