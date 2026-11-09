"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApplyColorScheme } from "@vis-a-lot/shared/lib/color-scheme";
import { useApplyLocale } from "@vis-a-lot/shared/lib/i18n";
import { LinguiProvider } from "@vis-a-lot/shared/lib/lingui-provider";
import { type ReactNode, useState } from "react";
import { MockServerProvider } from "./MockServerProvider";

export function Providers({ children }: { children: ReactNode }) {
  useApplyColorScheme();
  useApplyLocale();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <LinguiProvider>
      <QueryClientProvider client={queryClient}>
        <MockServerProvider>{children}</MockServerProvider>
      </QueryClientProvider>
    </LinguiProvider>
  );
}
