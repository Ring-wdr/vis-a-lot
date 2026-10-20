"use client";

import { AlertDialog } from "@/components/AlertDialog";
import { Workspace } from "@/components/workspace/Workspace";
import { Providers } from "./providers";

export default function AppRoot() {
  return (
    <Providers>
      <Workspace />
      <AlertDialog />
    </Providers>
  );
}
