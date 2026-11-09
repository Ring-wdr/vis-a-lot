"use client";

import type { ReactNode } from "react";
import { Providers } from "./providers";
import { SessionGate } from "./SessionGate";
import { SessionScope } from "./SessionScope";

export default function AppRoot({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <SessionGate>
        <SessionScope>{children}</SessionScope>
      </SessionGate>
    </Providers>
  );
}
