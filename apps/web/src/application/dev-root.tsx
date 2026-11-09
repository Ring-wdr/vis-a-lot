"use client";

import type { ReactNode } from "react";
import { Providers } from "./providers";
import { SessionGate } from "./SessionGate";

export default function DevRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <SessionGate>{children}</SessionGate>
    </Providers>
  );
}
