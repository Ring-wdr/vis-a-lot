"use client";

import { OverlayProvider } from "overlay-kit";
import { type ReactNode, Suspense } from "react";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { FeedBoot } from "./FeedBoot";
import { FeedBootScreen } from "./FeedBootScreen";
import { Providers } from "./providers";

const messages = defineMessages({
  ko: { loading: "화면을 불러오는 중" },
  en: { loading: "Loading the page" },
});

/** 피드 앱: QueryClient + 브라우저 안 mock 서버 → 피드 데이터 준비 → 화면 틀. vis-a-lot 로그인은 필요 없다. */
export default function FeedRoot({ children }: { children: ReactNode }) {
  const text = useT(messages);
  return (
    <Providers>
      <OverlayProvider>
        {/* 화면 틀이 query(?g=, ?present=)를 읽는다. */}
        <Suspense fallback={<FeedBootScreen message={text.loading} />}>
          <FeedBoot>{children}</FeedBoot>
        </Suspense>
      </OverlayProvider>
    </Providers>
  );
}
