"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OverlayProvider } from "overlay-kit";
import { type ReactNode, useState } from "react";
import { MockServerProvider } from "./MockServerProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MockServerProvider>
        {/* 팝업은 QueryClient 안에서 그려야 본문과 같은 서버 상태를 쓴다. */}
        <OverlayProvider>{children}</OverlayProvider>
      </MockServerProvider>
    </QueryClientProvider>
  );
}
