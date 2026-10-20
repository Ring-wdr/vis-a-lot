"use client";

import { Providers } from "@/application/providers";
import { SessionGate } from "@/application/SessionGate";
import { BootCheck } from "./boot-check";

export default function DevRoot() {
  return (
    <Providers>
      <SessionGate>
        <BootCheck />
      </SessionGate>
    </Providers>
  );
}
