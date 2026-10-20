"use client";

import dynamic from "next/dynamic";

// 앱 전체가 브라우저 안의 mock 서버에 의존하므로 SSR에서는 로딩 문구만 그린다.
// msw/browser, Worker 같은 브라우저 전용 모듈이 SSR 번들에 들어가지 않게 하는 역할도 한다.
export const ClientApp = dynamic(() => import("./app-root"), {
  ssr: false,
  loading: () => <p>불러오는 중…</p>,
});
