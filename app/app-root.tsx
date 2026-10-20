"use client";

import { Workspace } from "@/components/workspace/Workspace";
import { Providers } from "./providers";

export default function AppRoot() {
  return (
    <Providers>
      <Workspace />
    </Providers>
  );
}
