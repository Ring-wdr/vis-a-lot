"use client";

import { Providers } from "@/application/providers";
import { BootCheck } from "./boot-check";

export default function DevRoot() {
  return (
    <Providers>
      <BootCheck />
    </Providers>
  );
}
