"use client";

import { MockServerProvider } from "@/components/MockServerProvider";
import { BootCheck } from "./boot-check";

export default function AppRoot() {
  return (
    <MockServerProvider>
      <BootCheck />
    </MockServerProvider>
  );
}
