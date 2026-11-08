"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useApplyColorScheme } from "@/shared/lib/color-scheme";
import { useApplyLocale } from "@/shared/lib/i18n";
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
    <QueryClientProvider client={queryClient}>
      <MockServerProvider>{children}</MockServerProvider>
    </QueryClientProvider>
  );
}
