"use client";

import dynamic from "next/dynamic";
import { BootScreen } from "@/shared/ui/Loading";

// 피드도 브라우저 안의 mock 서버에 의존하므로 SSR에서는 부팅 화면만 그린다 (src/application/client-app.tsx와 같은 방식).
export const FeedClientApp = dynamic(() => import("./feed-root"), {
  ssr: false,
  loading: () => <BootScreen step="app" />,
});
