"use client";

import { OverlayProvider } from "overlay-kit";
import { type ReactNode, Suspense } from "react";
import { FeedBoot } from "./FeedBoot";
import { FeedBootScreen } from "./FeedBootScreen";
import { Providers } from "./providers";

/** 피드 앱: QueryClient + 브라우저 안 mock 서버 → 피드 데이터 준비 → 화면 틀. vis-a-lot 로그인은 필요 없다. */
export default function FeedRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <OverlayProvider>
        {/* 화면 틀이 query(?g=, ?present=)를 읽는다. */}
        <Suspense fallback={<FeedBootScreen message="화면을 불러오는 중" />}>
          <FeedBoot>{children}</FeedBoot>
        </Suspense>
      </OverlayProvider>
    </Providers>
  );
}
