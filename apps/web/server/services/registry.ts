// 서비스 목록. gateway 라우팅과 OAS 생성이 모두 이 목록을 기준으로 한다.

import * as authRoutes from "./auth/routes";
import * as chartRoutes from "./chart/routes";
import * as dataRoutes from "./data/routes";
import * as feedRoutes from "./feed/routes";
import { FEED_SECURITY_SCHEMES } from "./feed/security";

export const SERVICES = {
  auth: {
    basePath: "/api/auth",
    title: "vis-a-lot auth service",
    description: "로그인, 토큰 발급(rotation), 서비스 토큰, JWKS",
    routes: authRoutes,
  },
  data: {
    basePath: "/api/data",
    title: "vis-a-lot data service",
    description: "데이터셋 적재(등록)와 데이터셋 메타 조회",
    routes: dataRoutes,
  },
  chart: {
    basePath: "/api/chart",
    title: "vis-a-lot chart service",
    description: "서버사이드 차트 렌더링 job, item 조작, 툴팁, PNG, history",
    routes: chartRoutes,
  },
  feed: {
    basePath: "/api/feed",
    title: "vis-a-lot feed service",
    description:
      "사내 데이터 공유 피드 프로토타입: 게시물(이슈)·그룹·사용자·댓글·알림·뷰·보고서",
    routes: feedRoutes,
    securitySchemes: FEED_SECURITY_SCHEMES,
  },
} as const;

export type ServiceName = keyof typeof SERVICES;
