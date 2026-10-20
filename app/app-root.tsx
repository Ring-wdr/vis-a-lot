"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MockServerProvider } from "@/components/MockServerProvider";
import { BootCheck } from "./boot-check";

export default function AppRoot() {
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
        <BootCheck />
      </MockServerProvider>
    </QueryClientProvider>
  );
}
