"use client";

import { useLingui } from "@lingui/react/macro";
import { OverlayProvider } from "overlay-kit";
import { type ReactNode, Suspense } from "react";
import { FeedBoot } from "./FeedBoot";
import { FeedBootScreen } from "./FeedBootScreen";
import "./messages";
import { Providers } from "./providers";

/** Providers(Lingui context) 안에서 그린다. */
function LoadingScreen() {
  const { t } = useLingui();
  return <FeedBootScreen message={t`화면을 불러오는 중`} />;
}

/** 피드 앱: QueryClient + 브라우저 안 mock 서버 → 피드 데이터 준비 → 화면 틀. vis-a-lot 로그인은 필요 없다. */
export default function FeedRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <OverlayProvider>
        {/* 화면 틀이 query(?g=, ?present=)를 읽는다. */}
        <Suspense fallback={<LoadingScreen />}>
          <FeedBoot>{children}</FeedBoot>
        </Suspense>
      </OverlayProvider>
    </Providers>
  );
}
