"use client";

import { Providers } from "../providers";
import { BootCheck } from "./boot-check";

export default function DevRoot() {
  return (
    <Providers>
      <BootCheck />
    </Providers>
  );
}
