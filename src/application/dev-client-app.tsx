"use client";

import dynamic from "next/dynamic";

export const DevClientApp = dynamic(() => import("./dev-root"), {
  ssr: false,
  loading: () => <p>불러오는 중…</p>,
});
