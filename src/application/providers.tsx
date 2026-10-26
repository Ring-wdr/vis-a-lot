"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useApplyColorScheme } from "@/shared/lib/color-scheme";
import { MockServerProvider } from "./MockServerProvider";

export function Providers({ children }: { children: ReactNode }) {
  useApplyColorScheme();
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
