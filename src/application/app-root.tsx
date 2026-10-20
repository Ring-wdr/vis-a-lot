"use client";

import { AlertDialog } from "@/shared/ui/AlertDialog";
import { Workspace } from "@/views/workspace/ui/Workspace";
import { Providers } from "./providers";

export default function AppRoot() {
  return (
    <Providers>
      <Workspace />
      <AlertDialog />
    </Providers>
  );
}
