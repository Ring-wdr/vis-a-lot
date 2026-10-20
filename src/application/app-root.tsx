"use client";

import { Workspace } from "@/views/workspace/ui/Workspace";
import { Providers } from "./providers";

export default function AppRoot() {
  return (
    <Providers>
      <Workspace />
    </Providers>
  );
}
