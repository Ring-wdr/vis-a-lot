"use client";

import { Workspace } from "@/views/workspace/ui/Workspace";
import { Providers } from "./providers";
import { SessionGate } from "./SessionGate";

export default function AppRoot() {
  return (
    <Providers>
      <SessionGate>
        <Workspace />
      </SessionGate>
    </Providers>
  );
}
